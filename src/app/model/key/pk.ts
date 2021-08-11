import { Id } from './id'

export type Pk = Id & { readonly __: unique symbol }
