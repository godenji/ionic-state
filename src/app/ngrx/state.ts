import { EntityState as State } from '@ngrx/entity'
import { Entity } from '../model/entity'
import { Id } from '../model/key/id'

export interface EntityState<T extends Entity, Key extends Id>
  extends State<T> {
  isLoading: boolean
  isLoaded: boolean
  isAdding: boolean
  isAdded: boolean
  isUpdating: boolean
  isUpdated: boolean
  isDeleting: boolean
  isDeleted: boolean
  selectedId: any //Key
  selected: T
  error: any
  totalRecords: number
  currentPage: number
}

export const defaultState = {
  isLoading: false,
  isLoaded: false,
  isAdding: false,
  isAdded: false,
  isUpdating: false,
  isUpdated: false,
  isDeleting: false,
  isDeleted: false,
  selected: null,
  selectedId: null,
  error: null,
  totalRecords: 0,
  currentPage: 1
}
