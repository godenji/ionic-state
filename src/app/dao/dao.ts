import { StorageApi } from '../util/storage-api'
import { HttpResponse } from '@angular/common/http'
import { inject } from '@angular/core'
import { NetworkService } from '../util/network'
import { combineLatest, Observable, of, from } from 'rxjs'
import { map, mergeMap, tap, take } from 'rxjs/operators'
import { DaoContract } from './dao-contract'
import { Id } from '../model/key/id'
import { Entity } from '../model/entity'
import { QueryParams } from '../util/query-params'
import { QueryString } from '../util/query-string'
import { PaginatedResult } from '../util/paginated-result'
import { OfflineQueue } from '../util/offline-queue'
import { v4 as uuid } from 'uuid'

export type KeyType = 'uuid' | 'int' | 'long'

export const maxUnsignedInt = 4294967295

export abstract class Dao<T extends Entity> implements DaoContract<T> {
  baseApiUrl: string
  readonly API_URL: string

  /** define remote database entity column type (for offline id generation) */
  abstract keyType: KeyType

  private qs = new QueryString()

  /* batch of offline operations for client to sync with API server */
  private batch: OfflineQueue

  private apiTarget: string

  constructor(
    protected api: StorageApi,
    protected network: NetworkService,
    apiPath: string
  ) {
    this.baseApiUrl = api.environment.url
    this.API_URL = `${this.baseApiUrl}/${apiPath}`
    this.apiTarget = apiPath
    this.batch = inject(OfflineQueue)
  }

  protected isOnline() {
    return this.network.connected
  }

  toHttpResponse(t: T) {
    return of(new HttpResponse({ body: t, status: 200 }))
  }

  toHttpResponseMany(xs: T[]) {
    return new HttpResponse({ body: xs, status: 200 })
  }

  withDefaultHeaders(): {
    headers?: { [header: string]: string | string[] }
    observe: 'response'
  } {
    return {
      headers: this.api.token.value
        ? { 'X-Auth-Token': this.api.token.value }
        : undefined,
      observe: 'response'
    }
  }

  create(t: T) {
    if (this.isOnline()) {
      return this.api.remote
        .post<T>(
          this.API_URL,
          this.forCreate(t, 'online'),
          this.withDefaultHeaders()
        )
        .pipe(tap(x => this.setLocal(x.body)))
    }
    else {
      const entity = this.forCreate(t, 'offline') as T
      this.setLocal(entity)
      return this.toHttpResponse(entity)
    }
  }

  createMany(xs: T[]) {
    if (this.isOnline())
      return this.api.remote
        .post<T[]>(
          this.API_URL,
          this.forCreate(xs, 'online'),
          this.withDefaultHeaders()
        )
        .pipe(mergeMap(xs => this.storeManyLocal(of(xs)))
      )
    else
      return this.storeManyLocal(
        of(this.toHttpResponseMany(this.forCreate(xs, 'offline') as T[]))
      )
  }

  private forCreate(x: T | T[], status: 'online' | 'offline'): T | T[] {
    if (!(x instanceof Array)) {
      x = !x.id ? { ...x, id: this.generateId(status) } : x
    }
    else {
      if (!x.every(x => x?.id)) {
        x = x.map(t =>
          !t?.id ? { ...t, id: this.generateId(status) } : t
        )
      }
    }
    if (status == 'offline' && this.network.offline.withQueue) {
      this.batch.add(x, { key: this.apiTarget, action: 'add' })
    }
    return x
  }

  // generates entity id
  private generateId(status: 'online' | 'offline'): Id {
    switch (this.keyType) {
      case 'uuid':
        return uuid()
      case 'int':
        if (status === 'online') return 0

        let n = 0
        // require n > 2^32 (i.e. max unsigned int database column value)
        // when persisted to API server the client should replace `n` with sequence id
        // returned from the server and ngrx update state accordingly (see EntityReducer
        // `updatedMany`)
        while (n < maxUnsignedInt) {
          n = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
        }
        return n
      case 'long':
        return status === 'online' ? 0 : BigInt(Math.pow(2, 63) * Math.random())
    }
  }

  update(t: T) {
    if (this.isOnline()) {
      return this.api.remote
        .put<T>(`${this.API_URL}/${t.id}`, t, this.withDefaultHeaders())
        .pipe(tap(x => this.setLocal(x.body)))
    }
    else {
      this.setLocal(t)
      if (this.network.offline.withQueue) {
        this.batch.add(t, { key: this.apiTarget, action: 'update' })
      }
      return this.toHttpResponse(t)
    }
  }

  updateMany(xs: T[]) {
    if (this.isOnline()) {
      return this.api.remote
        .put<T[]>(this.API_URL, xs, this.withDefaultHeaders())
        .pipe(
          mergeMap(xs => this.storeManyLocal(of(xs)))
        )
    }
    else {
      if (this.network.offline.withQueue) {
        this.batch.add(xs, { key: this.apiTarget, action: 'update' })
      }
      return this.storeManyLocal(
        of(this.toHttpResponseMany(xs))
      )
    }
  }

  delete(t: T) {
    if (this.isOnline()) {
      const options = { ...this.withDefaultHeaders(), body: t }
      return this.api.remote
        .delete<T>(`${this.API_URL}/${t.id}`, options)
        .pipe(tap(x => this.unsetLocal(x.body)))
    }
    else {
      this.unsetLocal(t)
      this.handleOfflineDelete(t)
      return this.toHttpResponse(t)
    }
  }

  deleteMany(xs: T[]) {
    if (this.isOnline()) {
      const key = Entity.key
      // generate querystring key list: "foo?id=..&id=..&id=.."
      const qstring = `?${key}=` + xs.map(x => x.id).join(`&${key}=`)
      return this.api.remote
        .delete<T[]>(`${this.API_URL}${qstring}`, this.withDefaultHeaders())
        .pipe(
          tap(_ => this.unsetLocal(xs)),
          map(_ => this.toHttpResponseMany(xs))
        )
    }
    else {
      this.unsetLocal(xs)
      this.handleOfflineDelete(xs)
      return of(this.toHttpResponseMany(xs))
    }
  }

  private handleOfflineDelete(t: T | T[]) {
    if (this.network.offline.withQueue) {
      const isNumeric = ['int', 'long'].includes(this.keyType)
      if (isNumeric) {
        // add-entity operation occurred offline if id > maxUnsignedInt
        const f = (x: T) => (x.id as number) > maxUnsignedInt
        const isArray = Array.isArray(t)

        let xs: T[] = []
        if (isArray) xs = t.filter(f)
        else if (f(t)) xs = [t]

        if (xs.length) {
          // remove from queue (no corresponding remote entities to delete)
          this.batch.remove(xs, this.apiTarget)
          if (isArray) {
            const excludeIds = xs.map(x => x.id)
            // enqueue entities to delete that already exist on api server
            const ts = t.filter(x => !(excludeIds.includes(x.id)))
            if (ts.length) this.batch.add(ts, {key: this.apiTarget, action: 'delete'})
          }
        }
        else this.batch.add(t, {key: this.apiTarget, action: 'delete'})
      }
    }
  }

  findById<Key extends Id>(id: Key) {
    if (!this.isOnline()) return this.getLocal(id)
    return this.api.remote
      .get<T>(`${this.API_URL}/${id}`, this.withDefaultHeaders())
      .pipe(
        mergeMap(x => (x.body ? of(x) : this.getLocal(id))),
        tap(x => this.setLocal(x.body))
      )
  }

  findAll(q?: QueryParams) {
    return this._findAll(this.API_URL, q)
  }

  protected _findAll(url: string, q?: QueryParams) {
    if (!this.isOnline()) {
      return this.getManyLocal().pipe(map(x => this.paginate(x)))
    }
    let qs = this.qs.build(q)
    if (qs != '') qs = `?${qs}`
    return this.api.remote
      .get<PaginatedResult<T>>(
        `${url}${qs}`,
        this.withDefaultHeaders()
      )
      .pipe(
        mergeMap(pr =>
          this.storeManyLocal(of(this.toHttpResponseMany(pr.body.payload))).pipe(
            map(x =>
              this.paginate(x, pr.body.totalRecords, pr.body.currentPage)
            )
          )
        )
      )
  }

  protected paginate(
    x: HttpResponse<T[]>,
    totalRecords?: number,
    currentPage?: number
  ): HttpResponse<PaginatedResult<T>> {
    return x.clone({
      body: {
        payload: x.body,
        totalRecords: totalRecords || x.body.length,
        currentPage: currentPage || 1
      }
    })
  }

  storeManyLocal(payload: T[] | Observable<HttpResponse<T[]>>) {
    const p = (
      payload instanceof Array
        ? of(this.toHttpResponseMany(payload))
        : payload
    )

    const compareMax = (id: Id) => {
      switch (this.keyType) {
        case 'int':
        case 'long': return id as number > maxUnsignedInt
        default:
          // uuid string, default to true
          return true
      }
    }

    const combined = combineLatest([p, this.getManyLocal()])
    return combined.pipe(
      map(xs =>
        xs.reduce((a, b) => {
          const [remote, local] = [a.body || [], b.body || []]
          const ids = remote.map(x => x.id)
          const data =
            remote.concat(
              local.filter(x =>
                // only include local offline entities where max condition satisfied --
                // remote api is the source of truth, the only local entities
                // that should be preserved are those that were persisted offline (e.g.
                // with a generated id > max value)
                !ids.includes(x.id) && compareMax(x.id)
              )
            )
          return this.toHttpResponseMany(data)
        })
      ),
      tap(x => {
        this.api.local.set(this.API_URL, JSON.stringify(x.body))
        x.body.forEach(x => this.setLocal(x, false))
      }),
      mergeMap(_ => p)
    )
  }

  private getManyLocal(): Observable<HttpResponse<T[]>> {
    return from(this.api.local.get(this.API_URL)).pipe(
      map(xs => {
        const data = !!xs ? (JSON.parse(xs) as T[]) : []
        return this.toHttpResponseMany(data)
      })
    )
  }

  private getLocal<Key extends Id>(key: Key): Observable<HttpResponse<T>> {
    return from(this.api.local.get(`${this.API_URL}/${key}`)).pipe(
      mergeMap(x => this.toHttpResponse(JSON.parse(x)))
    )
  }

  private setLocal(t: T, withMany: boolean = true): void {
    this.api.local.set(`${this.API_URL}/${t.id}`, JSON.stringify(t)).then(_ => {
      // add entity to local storage list collection
      if (withMany) {
        this.getManyLocal()
          .toPromise()
          .then(x => {
            if (x && x.body) {
              let entities: T[]
              const idx = x.body.findIndex(e => e.id === t.id)
              if (idx === -1) entities = x.body.concat(t)
              else {
                // swap existing entity with latest version
                x.body.splice(idx, 1, t)
                entities = x.body
              }
              this.api.local.set(this.API_URL, JSON.stringify(entities))
            }
          })
      }
    })
  }

  unsetLocal(t: T | T[]): void {
    const remove = (x: T) => this.api.local.remove(`${this.API_URL}/${x.id}`)
    let ids: Id[] = []
    if (t instanceof Array) {
      t.forEach(x => remove(x))
      ids = t.map(x => x.id)
    } else {
      remove(t)
      ids = [t.id]
    }
    this.getManyLocal()
      .toPromise()
      .then(x => {
        if (x && x.body) {
          // remove entities from local storage list collection
          ids.forEach(id => {
            const idx = x.body.findIndex(e => e.id === id)
            idx > -1 ? x.body.splice(idx, 1) : ''
          })
          this.api.local.set(this.API_URL, JSON.stringify(x.body))
        }
      })
  }
}
