import { Entity } from '../model/entity'

export interface PaginatedResult<T extends Entity> {
  payload: T[]
  totalRecords: number
  currentPage: number
}
