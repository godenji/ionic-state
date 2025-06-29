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

  private storageWriteLock = Promise.resolve()
  private qs = new QueryString()

  private apiTarget: string

  constructor(
    protected api: StorageApi,
    protected network: NetworkService,
    protected batch: OfflineQueue,
    apiPath: string
  ) {
    this.baseApiUrl = api.environment.url
    this.API_URL = `${this.baseApiUrl}/${apiPath}`
    this.apiTarget = apiPath
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
        .pipe(
          mergeMap(x =>
            from(this.setLocal(x.body)).pipe(map(_ => x))
          )
        )
    }
    else {
      const entity = this.forCreate(t, 'offline') as T
      return from(this.setLocal(entity)).pipe(
        mergeMap(_ => this.toHttpResponse(entity))
      )
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
        .pipe(
          mergeMap(xs => this.storeManyLocal(of(xs))
        )
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

        // require n > 2^32 (i.e. max unsigned int database column value)
        // when persisted to API server the client should replace `n` with sequence id
        // returned from the server and ngrx update state accordingly (see EntityReducer
        // `updatedMany`)
        const min = maxUnsignedInt + 1
        const max = Number.MAX_SAFE_INTEGER
        return Math.floor(Math.random() * (max - min + 1)) + min
      case 'long':
        return status === 'online' ? 0 : BigInt(Math.pow(2, 63) * Math.random())
    }
  }

  update(t: T) {
    if (this.isOnline()) {
      return this.api.remote
        .put<T>(`${this.API_URL}/${t.id}`, t, this.withDefaultHeaders())
        .pipe(
          mergeMap(x =>
            from(this.setLocal(x.body)).pipe(map(_ => x))
          )
        )
    }
    else {
      if (this.network.offline.withQueue) {
        this.batch.add(t, { key: this.apiTarget, action: 'update' })
      }
      return from(
        this.setLocal(t)).pipe(
          mergeMap(_ => this.toHttpResponse(t))
        )
    }
  }

  updateAll(xs: T[]) {
    return this.updateMany(xs, { forAll: true })
  }

  updateMany(xs: T[], o?: { forAll: boolean }) {
    if (this.isOnline()) {
      return this.api.remote
        .put<T[]>(this.API_URL, xs, this.withDefaultHeaders())
        .pipe(
          mergeMap(xs => this.storeManyLocal(of(xs), o))
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
        .pipe(
          mergeMap(x =>
            from(this.unsetLocal(x.body)).pipe(map(_ => x))
          )
        )
    }
    else {
      this.handleOfflineDelete(t)
      return from(
        this.unsetLocal(t)).pipe(
          mergeMap(_ => this.toHttpResponse(t)
        )
      )
    }
  }

  deleteMany(xs: T[]) {
    if (this.isOnline()) {
      const key = Entity.key
      const qstring = `?${key}=` + xs.map(x => x.id).join(`&${key}=`)
      return this.api.remote
        .delete<T[]>(`${this.API_URL}${qstring}`, this.withDefaultHeaders())
        .pipe(
          mergeMap(_ =>
            from(this.unsetLocal(xs)).pipe(
              map(_ => this.toHttpResponseMany(xs))
            )
          )
        )
    }
    else {
      this.handleOfflineDelete(xs)
      return from(this.unsetLocal(xs)).pipe(
        mergeMap(_ => of(this.toHttpResponseMany(xs)))
      )
    }
  }

  private handleOfflineDelete(t: T | T[]) {
    if (this.network.offline.withQueue) {
      const isNumeric = ['int', 'long'].includes(this.keyType)

      // string/uuid key
      if (!isNumeric) this.batch.add(t, {key: this.apiTarget, action: 'delete'})
      //
      // numeric
      else {
        // add-entity operation occurred offline if id > maxUnsignedInt
        const f = (x: T) => (x.id as number) > maxUnsignedInt
        const isArray = Array.isArray(t)

        let xs: T[] = []
        if (isArray) xs = t.filter(f)
        else if (f(t)) xs = [t]

        if (!xs.length) this.batch.add(t, {key: this.apiTarget, action: 'delete'})
        else {
          // remove from queue (no corresponding remote entities to delete)
          this.batch.remove(xs, this.apiTarget)
          if (isArray) {
            const excludeIds = xs.map(x => x.id)
            // enqueue entities to delete that already exist on api server
            const ts = t.filter(x => !(excludeIds.includes(x.id)))
            if (ts.length) this.batch.add(ts, {key: this.apiTarget, action: 'delete'})
          }
        }
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

  storeManyLocal(
    payload: T[] | Observable<HttpResponse<T[]>>,
    o?: { forAll: boolean }
  ) {
    const p = (
      payload instanceof Array
        ? of(this.toHttpResponseMany(payload))
        : payload
    )

    const isMax = (id: Id) => {
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
      map(([a, b]) => {
        const [remote, local] = [a.body || [], b.body || []]
        const ids = remote.map(x => x.id)
        const offlineEntities = local.filter(x => !ids.includes(x.id))

        const [data, orphans] = o?.forAll ? [
          // when forAll true, only include local offline entities where max condition
          // satisfied -- remote api is the source of truth, the only local entities
          // that should be preserved are those that were persisted offline (e.g.
          // with a generated id > max value)
          remote.concat(offlineEntities.filter(x => isMax(x.id))),
          offlineEntities.filter(x => !isMax(x.id))
        ] : [
          remote.concat(offlineEntities),
          []
        ]
        return {
          request: this.toHttpResponseMany(data),
          orphans
        }
      }),
      tap(x => {
        from(this.api.local.set(this.API_URL, JSON.stringify(x.request.body)))
        x.request.body.forEach(x => this.setLocal(x, false))
        x.orphans.forEach(x => this.unsetLocal(x, false))
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

  private async setLocal(t: T, withMany: boolean = true): Promise<void> {
    await this.storageWriteLock
    this.storageWriteLock = (async _ => {
      await this.api.local.set(`${this.API_URL}/${t.id}`, JSON.stringify(t))
      if (withMany) {
        const many = await this.getManyLocal().toPromise()
        if (many && many.body) {
          const entities = [...many.body]
          const idx = entities.findIndex(e => e.id === t.id)
          if (idx === -1) {
            entities.push(t)
          } else {
            entities[idx] = t
          }
          await this.api.local.set(this.API_URL, JSON.stringify(entities))
        }
      }
    })()
    return this.storageWriteLock
  }

  async unsetLocal(t: T | T[], withMany: boolean = true): Promise<void> {
    await this.storageWriteLock
    this.storageWriteLock = (async _ => {
      const remove = (x: T) => this.api.local.remove(`${this.API_URL}/${x.id}`)
      let ids: Id[] = []
      if (t instanceof Array) {
        await Promise.all(t.map(x => remove(x)))
        ids = t.map(x => x.id)
      } else {
        await remove(t)
        ids = [t.id]
      }
      if (withMany) {
        const many = await this.getManyLocal().toPromise()
        if (many && many.body) {
          const entities = many.body.filter(e => !ids.includes(e.id))
          await this.api.local.set(this.API_URL, JSON.stringify(entities))
        }
      }
    })()
    return this.storageWriteLock
  }
}
