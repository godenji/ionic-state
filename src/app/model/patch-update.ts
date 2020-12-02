import { Id } from './key/id'

export type PatchUpdate = {
  id: Id
  params: {
    [key: string]: any
  }
}
