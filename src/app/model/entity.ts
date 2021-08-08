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

  /**
   * assigns given data object `x` to target entity `t`
   *
   * @param t entity
   * @param x data object
   * @returns T modified entity
   */
  export function copy<T extends Entity>(t: T, x: { [key: string]: any }): T {
    return Object.assign(t, x)
  }

  /**
   * creates new entity given data object `x`
   *
   * @param x data object
   * @returns T new entity
   */
  export function apply<T extends Entity>(x: { [key: string]: any }): T {
    return Object.assign({}, x) as T
  }
}
