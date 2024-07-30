import { StorageApi } from '../util/storage-api'
import { HttpResponse } from '@angular/common/http'
import { NetworkService } from '../util/network'
import { combineLatest, Observable, of, from } from 'rxjs'
import { map, mergeMap, tap, take } from 'rxjs/operators'
import { DaoContract } from './dao-contract'
import { Id } from '../model/key/id'
import { Entity } from '../model/entity'
import { PatchUpdate } from '../model/patch-update'
import { QueryParams } from '../util/query-params'
import { QueryString } from '../util/query-string'
import { PaginatedResult } from '../util/paginated-result'
import { v4 as uuid } from 'uuid'

export type KeyType = 'uuid' | 'int' | 'long'

export abstract class Dao<T extends Entity> implements DaoContract<T> {
  baseApiUrl: string
  readonly API_URL: string

  /** define remote database entity column type (for offline id generation) */
  abstract keyType: KeyType

  private qs = new QueryString()

  constructor(
    protected api: StorageApi,
    protected network: NetworkService,
    apiPath: string
  ) {
    this.baseApiUrl = api.environment.url
    this.API_URL = `${this.baseApiUrl}/${apiPath}`
  }

  protected isOnline() {
    return this.network.connected
  }

  private response(t: T) {
    return of(new HttpResponse({ body: t, status: 200 }))
  }

  private responseMany(xs: T[]) {
    return new HttpResponse({ body: xs, status: 200 })
  }

  withDefaultHeaders(): {
    headers?: { [header: string]: string | string[] }
    observe: 'response'
  } {
    return {
      headers: this.api.token ? { 'X-Auth-Token': this.api.token } : undefined,
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
    } else {
      const entity = this.forCreate(t, 'offline') as T
      this.setLocal(entity)
      return this.response(entity)
    }
  }

  createMany(xs: T[]) {
    if (this.isOnline())
      return this.combineMany(
        this.api.remote.post<T[]>(
          `${this.API_URL}/many`,
          this.forCreate(xs, 'online'),
          this.withDefaultHeaders()
        )
      )
    else
      return this.combineMany(
        of(this.responseMany(this.forCreate(xs, 'offline') as T[]))
      )
  }

  private forCreate(x: T | T[], status: 'online' | 'offline'): T | T[] {
    if (!(x instanceof Array))
      return !x.id ? { ...x, id: this.generateId(status) } : x
    else {
      if (!x.every(x => x?.id)) {
        x = x.map(x => {
          if (!x?.id) x.id = this.generateId(status)
          return x
        })
      }
      return x
    }
  }

  // generates entity id
  private generateId(status: 'online' | 'offline'): Id {
    switch (this.keyType) {
      case 'uuid':
        return uuid()
      case 'int':
        if (status === 'online') return 0

        let n = 0
        // require n > max unsigned int 2^32
        // why? remote database column `int` value can be no greater than 2^32,
        // while chance of collision with offline generated ids is extremely small
        // (e.g. if # of generated ids = 100k collision probability is .0001%)
        while (n < 4294967295) {
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
    } else {
      this.setLocal(t)
      return this.response(t)
    }
  }

  updateMany(xs: PatchUpdate[]) {
    if (this.isOnline()) {
      return this.api.remote
        .patch<PatchUpdate[]>(this.API_URL, xs, this.withDefaultHeaders())
        .pipe(tap(x => this.patchLocal(x.body)))
    } else {
      this.patchLocal(xs)
      return of(new HttpResponse({ body: xs, status: 200 }))
    }
  }

  private patchLocal(batch: PatchUpdate[]) {
    const updated$ = this.getManyLocal().pipe(
      map(x => {
        let entities: T[] = []
        x.body.forEach(x => {
          const p = batch.find(p => p.id === x.id)
          entities.push(!p ? x : { ...x, ...p.params })
        })
        return entities
      })
    )
    updated$.pipe(take(1)).subscribe(xs => {
      if (xs.length) {
        xs.forEach(x => this.setLocal(x, false))
        this.api.local.set(this.API_URL, JSON.stringify(xs))
      }
    })
  }

  delete(t: T) {
    if (this.isOnline()) {
      const options = { ...this.withDefaultHeaders(), body: t }
      return this.api.remote
        .delete<T>(`${this.API_URL}/${t.id}`, options)
        .pipe(tap(x => this.unsetLocal(x.body)))
    } else {
      this.unsetLocal(t)
      return this.response(t)
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
          map(_ => this.responseMany(xs))
        )
    } else {
      this.unsetLocal(xs)
      return of(this.responseMany(xs))
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
          this.combineMany(of(this.responseMany(pr.body.payload))).pipe(
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

  protected combineMany(payload: Observable<HttpResponse<T[]>>) {
    const combined = combineLatest([payload, this.getManyLocal()])
    return combined.pipe(
      map(x =>
        x.reduce((a, b) => {
          const [remote, local] = [a.body || [], b.body || []]
          const ids = remote.map(x => x.id)
          const data = remote.concat(local.filter(x => !ids.includes(x.id)))
          return this.responseMany(data)
        })
      ),
      tap(x => {
        this.api.local.set(this.API_URL, JSON.stringify(x.body))
        x.body.forEach(x => this.setLocal(x, false))
      })
    )
  }

  private getManyLocal(): Observable<HttpResponse<T[]>> {
    return from(this.api.local.get(this.API_URL)).pipe(
      map(xs => {
        const data = !!xs ? (JSON.parse(xs) as T[]) : []
        return this.responseMany(data)
      })
    )
  }

  private getLocal<Key extends Id>(key: Key): Observable<HttpResponse<T>> {
    return from(this.api.local.get(`${this.API_URL}/${key}`)).pipe(
      mergeMap(x => this.response(JSON.parse(x)))
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

  private unsetLocal(t: T | T[]): void {
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
