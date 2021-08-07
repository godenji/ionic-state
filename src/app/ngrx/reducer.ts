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
    return Object.assign({}, this.state, {
      ...this.getDefaultState(),
      isLoading: true
    })
  }

  loaded(x: PaginatedResult<T>) {
    this.currentPage = x.currentPage
    if (x.totalRecords > this.state.totalRecords) {
      this.totalRecords = x.totalRecords
    }
    const state = Object.assign({}, this.state, {
      ...this.getDefaultState(),
      isLoaded: true
    })
    return this.adapter.upsertMany(x.payload, state)
  }

  loadedOne(payload: T) {
    const state = Object.assign({}, this.state, {
      ...this.getDefaultState(),
      isLoaded: true,
      selected: payload,
      selectedId: payload.id
    })
    return this.adapter.upsertOne(payload, state)
  }

  add() {
    return this.setAdding()
  }

  addMany() {
    return this.setAdding()
  }

  private setAdding() {
    return Object.assign({}, this.state, {
      ...this.getDefaultState(),
      isAdding: true
    })
  }

  added(payload: T) {
    const state = Object.assign({}, this.addedState(1), {
      selected: payload,
      selectedId: payload.id
    })
    return this.adapter.upsertOne(payload, state)
  }

  addedMany(payload: T[]) {
    return this.adapter.addMany(payload, this.addedState(payload?.length))
  }

  private addedState(count: number) {
    this.setTotalRecords('add', count)
    return Object.assign({}, this.state, {
      ...this.getDefaultState(),
      isAdded: true
    })
  }

  update() {
    return this.setUpdating()
  }

  updateMany() {
    return this.setUpdating()
  }

  private setUpdating() {
    return Object.assign({}, this.state, {
      ...this.getDefaultState(),
      isUpdating: true
    })
  }

  updated(payload: T) {
    return this.adapter.updateOne(
      { id: `${payload.id}`, changes: payload },
      Object.assign({}, this.state, {
        ...this.getDefaultState(),
        selected: payload,
        selectedId: payload.id,
        isUpdated: true
      })
    )
  }

  updatedMany(payload: PatchUpdate[]) {
    let entities: T[] = []
    this.adapter
      .getSelectors()
      .selectAll(this.state)
      .map(x => this.serialize(x))
      .forEach(entity => {
        const partial = payload.find(p => p.id === entity.id)
        if (partial) {
          entities.push(Entity.copy(entity, { ...partial.params }))
        }
      })
    if (entities && entities.length) {
      return this.adapter.updateMany(
        entities.map(x => {
          return { id: `${x.id}`, changes: x }
        }),
        Object.assign({}, this.state, {
          ...this.getDefaultState(),
          isUpdated: true
        })
      )
    } else return this.state
  }

  delete() {
    return this.setDeleting()
  }

  deleteMany() {
    return this.setDeleting()
  }

  private setDeleting() {
    return Object.assign({}, this.state, {
      ...this.getDefaultState(),
      isDeleting: true
    })
  }

  deleted(payload: T) {
    const state = this.deletedState(this.state, 1)
    return this.adapter.removeOne(`${payload.id}`, state)
  }

  deletedMany(payload: T[]) {
    const state = this.deletedState(this.state, payload.length)
    const ids = payload.map(x => `${x.id}`)
    return this.adapter.removeMany(ids, state)
  }

  private deletedState(state: S, count: number) {
    this.setTotalRecords('minus', count)
    return Object.assign({}, state, {
      ...this.getDefaultState(),
      isDeleted: true
    })
  }

  selected(payload?: T) {
    return Object.assign({}, this.state, {
      ...this.getDefaultState(),
      selected: payload,
      selectedId: payload ? payload.id : null
    })
  }

  failed(payload: Error) {
    return Object.assign({}, this.state, {
      ...this.getDefaultState(),
      error: payload.message
    })
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
