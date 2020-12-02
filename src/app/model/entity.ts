import { Id } from './key/id'

export abstract class Entity {
  id?: Id

  abstract copy(data: { [key: string]: any })
}
