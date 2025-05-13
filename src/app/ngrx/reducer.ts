import { EntityAdapter } from '@ngrx/entity'
import { EntityState, defaultState } from './state'
import { Entity } from '../model/entity'
import { Id } from '../model/key/id'
import { PatchUpdate } from '../model/patch-update'
import { PaginatedResult } from '../util/paginated-result'

export class EntityReducer<
  T extends Entity,
  Key extends Id,
  S extends EntityState<T, Key>
> {
  constructor(
    readonly adapter: EntityAdapter<T>,
    readonly state: S,
    protected serialize: (t: T) => T
  ) {
    this.currentPage = this.state.currentPage
    this.totalRecords = this.state.totalRecords
  }

  private currentPage: number
  private totalRecords: number

  private getDefaultState() {
    return {
      ...defaultState,
      totalRecords: this.totalRecords,
      currentPage: this.currentPage
    }
  }

  loading() {
    return {
      ...this.state,
      ...this.getDefaultState(),
      isLoading: true
    }
  }

  loaded(x: PaginatedResult<T>) {
    this.currentPage = x.currentPage
    if (x.totalRecords > this.state.totalRecords) {
      this.totalRecords = x.totalRecords
    }
    return this.adapter.upsertMany(x.payload, {
      ...this.state,
      ...this.getDefaultState(),
      isLoaded: true
    })
  }

  loadedOne(payload: T) {
    return this.adapter.upsertOne(payload, {
      ...this.state,
      ...this.getDefaultState(),
      isLoaded: true,
      selected: payload,
      selectedId: payload.id
    })
  }

  add() {
    return this.setAdding()
  }

  addMany() {
    return this.setAdding()
  }

  private setAdding() {
    return {
      ...this.state,
      ...this.getDefaultState(),
      isAdding: true
    }
  }

  added(payload: T) {
    return this.adapter.upsertOne(payload, {
      ...this.addedState(1),
      selected: payload,
      selectedId: payload.id
    })
  }

  addedMany(payload: T[]) {
    return this.adapter.addMany(payload, this.addedState(payload?.length))
  }

  private addedState(count: number) {
    this.setTotalRecords('add', count)
    return {
      ...this.state,
      ...this.getDefaultState(),
      isAdded: true
    }
  }

  update() {
    return this.setUpdating()
  }

  updateMany() {
    return this.setUpdating()
  }

  private setUpdating() {
    return {
      ...this.state,
      ...this.getDefaultState(),
      isUpdating: true
    }
  }

  updated(payload: T) {
    return this.adapter.setOne(
      payload,
      {
        ...this.state,
        ...this.getDefaultState(),
        selected: payload,
        selectedId: payload.id,
        isUpdated: true
      }
    )
  }

  updatedMany(payload: T[]) {
    if (!payload.length) return this.state
    return this.adapter.setMany(
      payload,
      {
        ...this.state,
        ...this.getDefaultState(),
        isUpdated: true
      }
    )
  }

  patchedMany(payload: PatchUpdate[]) {
    const f = (entity: T) =>
      payload.find(p => p.id === entity.id)

    let entities: T[] = []
    this.adapter
      .getSelectors()
      .selectAll(this.state)
      .forEach(x => {
        const p = f(x)
        if (p) {
          // discard id param if exists (i.e. perform update based on existing entity id)
          const { id, ...rest } = p.params
          entities.push({ ...x, ...rest })
        }
      })

    if (!entities.length) return this.state
    return this.adapter.updateMany(
      entities.map(x => {
        const p = f(x)
        const { id, ...rest } = p.params
        // include id param in changeset if exists (i.e. to update the entity id itself)
        const changes = id ? { ...x, id } : { ...x }
        return { id: `${x.id}`, changes }
      }),
      {
        ...this.state,
        ...this.getDefaultState(),
        isUpdated: true
      }
    )
  }

  delete() {
    return this.setDeleting()
  }

  deleteMany() {
    return this.setDeleting()
  }

  private setDeleting() {
    return {
      ...this.state,
      ...this.getDefaultState(),
      isDeleting: true
    }
  }

  deleted(payload: T) {
    return this.adapter.removeOne(
      `${payload.id}`,
      this.deletedState(this.state, 1)
    )
  }

  deletedMany(payload: T[]) {
    const ids = payload.map(x => `${x.id}`)
    return this.adapter.removeMany(
      ids,
      this.deletedState(this.state, payload?.length)
    )
  }

  private deletedState(state: S, count: number) {
    this.setTotalRecords('minus', count)
    return {
      ...state,
      ...this.getDefaultState(),
      isDeleted: true
    }
  }

  selected(payload?: T) {
    return {
      ...this.state,
      ...this.getDefaultState(),
      selected: payload,
      selectedId: payload ? payload.id : null
    }
  }

  failed(payload: Error) {
    return {
      ...this.state,
      ...this.getDefaultState(),
      error: payload.message
    }
  }

  private setTotalRecords(op: 'add' | 'minus', count: number): void {
    const x = this.state.totalRecords
    if (x) this.totalRecords = op === 'add' ? x + count : x - count
  }
}

export class EntitySelector<T extends Entity> {
  constructor(readonly adapter: EntityAdapter<T>) {}

  selectors() {
    const {
      selectIds: selectIds,
      selectEntities: selectEntities,
      selectAll: selectAll,
      selectTotal: selectTotal
    } = this.adapter.getSelectors()

    return {
      selectIds: selectIds,
      selectEntities: selectEntities,
      selectAll: selectAll,
      selectTotal: selectTotal
    }
  }
}
