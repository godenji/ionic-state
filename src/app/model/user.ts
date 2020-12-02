import { Id } from './key/id'
import { Entity } from './entity'

export abstract class User<Key extends Id = Id> extends Entity {
  id: Key
}
