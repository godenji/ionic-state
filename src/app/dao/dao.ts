import { StorageApi } from '../util/storage-api'
import { HttpResponse } from '@angular/common/http'
import { NetworkService } from '../util/network'
import { combineLatest, Observable, of, from } from 'rxjs'
import { map, flatMap, tap, take } from 'rxjs/operators'
import { DaoContract } from './dao-contract'
import { Id } from '../model/key/id'
import { Entity } from '../model/entity'
import { PatchUpdate } from '../model/patch-update'
import { QueryParams } from '../util/query-params'
import { QueryString } from '../util/query-string'
import { PaginatedResult } from '../util/paginated-result'
import { v4 as uuid } from 'uuid'

export abstract class Dao<T extends Entity> implements DaoContract<T> {
  baseApiUrl: string
  readonly API_URL: string

  abstract deserialize(response: HttpResponse<T>): HttpResponse<T>
  abstract deserializeMany(response: HttpResponse<T[]>): HttpResponse<T[]>

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
    return !this.network.isOfflineMode && this.network.isOnline()
  }

  private response(t: T, deserialize?: 'deserialize') {
    return deserialize
      ? of(this.deserialize(new HttpResponse({ body: t, status: 200 })))
      : of(new HttpResponse({ body: t, status: 200 }))
  }

  private responseMany(x: T[]) {
    return new HttpResponse({ body: x, status: 200 })
  }

  withDefaultHeaders(): {
    headers?: { [header: string]: string | string[] }
    observe: 'response'
  } {
    return {
      headers: this.api.token ? { 'X-Auth-Token': this.api.token } : null,
      observe: 'response'
    }
  }

  create(t: T) {
    if (this.isOnline()) {
      return this.api.remote
        .post<T>(this.API_URL, t, this.withDefaultHeaders())
        .pipe(
          tap(x => this.setLocal(x.body)),
          map(this.deserialize)
        )
    } else {
      // generate uuid for offline entity if id not set
      const entity: T = !t.id ? Entity.copy(t, { id: uuid() }) : t
      this.setLocal(entity)
      return this.response(entity)
    }
  }

  createMany(xs: T[]) {
    if (this.isOnline()) {
      return this.combineMany(
        this.api.remote.post<T[]>(
          `${this.API_URL}/many`,
          xs,
          this.withDefaultHeaders()
        )
      )
    } else return this.combineMany(of(this.responseMany(xs)))
  }

  update(t: T) {
    if (this.isOnline()) {
      return this.api.remote
        .put<T>(`${this.API_URL}/${t.id}`, t, this.withDefaultHeaders())
        .pipe(
          tap(x => this.setLocal(x.body)),
          map(this.deserialize)
        )
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
    const updated$ = this.getManyLocal('deserialize').pipe(
      map(x => {
        let entities: T[] = []
        x.body.forEach(x => {
          const p = batch.find(p => p.id === x.id)
          entities.push(!p ? x : Entity.copy(x, { ...p.params }))
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
      return this.api.remote.delete<T>(`${this.API_URL}/${t.id}`, options).pipe(
        tap(x => this.unsetLocal(x.body)),
        map(this.deserialize)
      )
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
    if (this.isOnline()) {
      return this.api.remote
        .get<T>(`${this.API_URL}/${id}`, this.withDefaultHeaders())
        .pipe(
          flatMap(x => (x.body ? of(x) : this.getLocal(id))),
          tap(x => this.setLocal(x.body)),
          map(this.deserialize)
        )
    } else return this.getLocal(id)
  }

  findAll(q?: QueryParams) {
    if (this.isOnline()) {
      let qs = this.qs.build(q)
      if (qs != '') qs = `?${qs}`
      return this.api.remote
        .get<PaginatedResult<T>>(
          `${this.API_URL}${qs}`,
          this.withDefaultHeaders()
        )
        .pipe(
          flatMap(pr =>
            this.combineMany(of(this.responseMany(pr.body.payload))).pipe(
              map(x =>
                this.paginate(x, pr.body.totalRecords, pr.body.currentPage)
              )
            )
          )
        )
    } else
      return this.getManyLocal('deserialize').pipe(map(x => this.paginate(x)))
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
      }),
      map(this.deserializeMany)
    )
  }

  private getManyLocal(
    deserialize?: 'deserialize'
  ): Observable<HttpResponse<T[]>> {
    return from(this.api.local.get(this.API_URL)).pipe(
      map(xs => {
        const data = !!xs ? (JSON.parse(xs) as T[]) : []
        const resp = this.responseMany(data)
        return !!xs && deserialize ? this.deserializeMany(resp) : resp
      })
    )
  }

  private getLocal<Key extends Id>(key: Key): Observable<HttpResponse<T>> {
    return from(this.api.local.get(`${this.API_URL}/${key}`)).pipe(
      flatMap(x => this.response(JSON.parse(x), 'deserialize'))
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
