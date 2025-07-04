import { Observable } from 'rxjs'
import { Entity } from '../model/entity'
import { Id } from '../model/key/id'
import { HttpResponse } from '@angular/common/http'
import { QueryParams } from '../util/query-params'
import { PaginatedResult } from '../util/paginated-result'

export interface DaoContract<T extends Entity> {
  create(t: T): Observable<HttpResponse<T>>
  createMany(xs: T[]): Observable<HttpResponse<T[]>>
  update(t: T): Observable<HttpResponse<T>>
  updateMany(xs: T[]): Observable<HttpResponse<T[]>>
  updateAll(xs: T[]): Observable<HttpResponse<T[]>>
  delete(t: T): Observable<HttpResponse<T>>
  deleteMany(t: T[]): Observable<HttpResponse<T[]>>
  findById<Key extends Id>(id: Key): Observable<HttpResponse<T>>
  findAll(q?: QueryParams): Observable<HttpResponse<PaginatedResult<T>>>
}
