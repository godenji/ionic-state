import { Action } from '@ngrx/store'
import { Entity } from '../model/entity'
import { Id } from '../model/key/id'
import { QueryParams } from '../util/query-params'

export abstract class NgrxAction<T = any> implements Action {
  abstract readonly type: string
  constructor(public payload?: T) {}
}

export interface EntityActions<T extends Entity, Key extends Id> {
  loading(q?: QueryParams): NgrxAction
  loadingOne(id: Key): NgrxAction
  select(t: T): NgrxAction<T>
  create(t: T): NgrxAction<T>
  createMany(t: T[]): NgrxAction<T[]>
  update(t: T): NgrxAction<T>
  updateMany(t: T[]): NgrxAction<T[]>
  delete(t: T): NgrxAction<T>
  deleteMany(t: T[]): NgrxAction<T[]>
}
