import { Action, Store } from '@ngrx/store'
import { Observable, combineLatest } from 'rxjs'
import { map, filter, take } from 'rxjs/operators'
import { List } from 'immutable'
import { Entity } from '../model/entity'
import { EntityState } from './state'
import { EntityActions } from './action'
import { Id } from '../model/key/id'
import { PatchUpdate } from '../model/patch-update'
import { QueryParams } from '../util/query-params'
import { PaginatedResult } from '../util/paginated-result'

export abstract class EntityStore<T extends Entity, Key extends Id> {
  protected store: Store<any>

  loading$: Observable<boolean>
  loaded$: Observable<boolean>
  adding$: Observable<boolean>
  added$: Observable<boolean>
  updating$: Observable<boolean>
  updated$: Observable<boolean>
  deleting$: Observable<boolean>
  deleted$: Observable<boolean>
  selected$: Observable<T>
  entities$: Observable<List<T>>
  paginated$: Observable<PaginatedResult<T>>
  success$: Observable<List<T>>
  error$: Observable<any>

  constructor(
    protected entity: EntityActions<T, Key>,
    protected store$: Observable<EntityState<T, Key>>,
    protected selectAll: (state: EntityState<T, Key>) => T[]
  ) {
    this.entities$ = store$.pipe(map(x => List(selectAll(x))))
    this.loading$ = store$.pipe(map(x => x.isLoading))
    this.loaded$ = store$.pipe(map(x => x.isLoaded))
    this.adding$ = store$.pipe(map(x => x.isAdding))
    this.added$ = store$.pipe(map(x => x.isAdded))
    this.updating$ = store$.pipe(map(x => x.isUpdating))
    this.updated$ = store$.pipe(map(x => x.isUpdated))
    this.deleting$ = store$.pipe(map(x => x.isDeleting))
    this.deleted$ = store$.pipe(map(x => x.isDeleted))
    this.selected$ = store$.pipe(map(x => x.selected))
    this.paginated$ = combineLatest(
      this.entities$,
      store$.pipe(map(x => x.totalRecords)),
      store$.pipe(map(x => x.currentPage))
    ).pipe(
      map(([xs, total, page]) => {
        return { payload: xs.toArray(), totalRecords: total, currentPage: page }
      })
    )
    this.success$ = combineLatest(
      this.entities$,
      this.selected$,
      this.added$,
      this.updated$,
      this.deleted$
    ).pipe(
      filter(
        ([entities, selected, a, b, deleted]) =>
          (a || b || deleted) &&
          (Boolean(selected) || deleted || entities.size > 0)
      ),
      map(([entities, selected, , ,]) => {
        if (selected) return List([selected])
        else return entities
      })
    )
    this.error$ = store$.pipe(map(x => x.error))
  }

  onResult(success: (t: T | T[]) => void, error?: (t: any) => void) {
    this.onSuccess(success)
    if (error) this.onError(error)
  }

  onSuccess(op: (t: T | T[]) => void) {
    this.success$.pipe(take(1)).subscribe(xs => {
      if (xs.size === 1) op(xs.first())
      else op(xs.toArray())
    })
  }

  onError(op: (t: any) => void) {
    this.error$
      .pipe(
        filter(x => !!x),
        take(1)
      )
      .subscribe(x => op(x))
  }

  private dispatch(action: Action) {
    this.store.dispatch(action)
  }

  load(q?: QueryParams) {
    this.dispatch(this.entity.loading(q))
  }

  loadOne(id: Key) {
    this.dispatch(this.entity.loadingOne(id))
    return this.selected$.pipe(filter(x => !!x))
  }

  select(x: T) {
    this.dispatch(this.entity.select(x))
  }

  create(x: T) {
    this.dispatch(this.entity.create(x))
  }

  createMany(xs: List<T>) {
    this.dispatch(this.entity.createMany(xs))
  }

  update(x: T) {
    this.dispatch(this.entity.update(x))
  }

  updateMany(xs: List<PatchUpdate>) {
    this.dispatch(this.entity.updateMany(xs))
  }

  delete(x: T) {
    this.dispatch(this.entity.delete(x))
  }

  deleteMany(xs: T[]) {
    this.dispatch(this.entity.deleteMany(xs))
  }

  findBy(cond: (u: T) => boolean): Observable<T> {
    return this.entities$.pipe(map(xs => xs && xs.find(t => cond(t))))
  }

  findAllBy(cond: (u: T) => boolean): Observable<List<T>> {
    return this.entities$.pipe(map(xs => xs && xs.filter(t => cond(t))))
  }
}
