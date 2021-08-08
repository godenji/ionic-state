import { Entity } from './entity'
import { User } from './user'
import { Pk } from './key/pk'

export interface Session<U extends User = User> extends Entity {
  id: Pk
  user: U
}
