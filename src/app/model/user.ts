import { Id } from './key/id'
import { Entity } from './entity'

export interface User<Key extends Id = Id> extends Entity {
  id: Key
}
