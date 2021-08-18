import { Id } from './key/id'

/**
 * model base class
 */
export interface Entity {
  /**
   * entity id
   */
  id?: Id
}

export namespace Entity {
  export const key = 'id'
}
