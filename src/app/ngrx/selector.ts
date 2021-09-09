import { Dictionary } from '@ngrx/entity'
import { createFeatureSelector, createSelector } from '@ngrx/store'
import { Entity } from '../model/entity'
import { Id } from '../model/key/id'
import { EntityState } from './state'
import { PaginatedResult } from '../util/paginated-result'

export type Selectors<
  T extends Entity,
  Key extends Id,
  E extends EntityState<T, Key>
> = {
  selectIds: (e: E) => string[] | number[]
  selectEntities: (e: E) => Dictionary<T>
  selectAll: (e: E) => T[]
  selectTotal: (e: E) => number
}

export class Selector<
  T extends Entity,
  Key extends Id,
  E extends EntityState<T, Key>
> {
  constructor(
    readonly featureKey: string,
    readonly selector: Selectors<T, Key, E>
  ) {}

  feature = createFeatureSelector<E>(this.featureKey)

  all = createSelector(this.feature, this.selector.selectAll)
  map = createSelector(this.feature, this.selector.selectEntities)
  ids = createSelector(this.feature, this.selector.selectIds)
  total = createSelector(this.feature, this.selector.selectTotal)
  byId = createSelector(this.map, xs => (id: Key) => xs[`${id}`])

  allWithEntities<P extends Entity, U extends P>(xs: T[], f: (t: T) => U): U[] {
    return xs.map(f)
  }

  paginated = createSelector(this.feature, this.all, (x, xs) => {
    return {
      payload: xs,
      totalRecords: x.totalRecords,
      currentPage: x.currentPage
    }
  })

  paginatedWithEntities<P extends Entity, U extends P>(
    x: PaginatedResult<T>,
    f: (t: T) => U
  ) {
    return {
      payload: x.payload.map(f),
      totalRecords: x.totalRecords,
      currentPage: x.currentPage
    } as PaginatedResult<U>
  }
}
