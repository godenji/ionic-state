export abstract class Id<T = Id.Default> {
  static key = 'id'

  constructor(readonly value: T) {}

  toString(): string {
    return `${this.value}`
  }
}

namespace Id {
  export type UUID = string
  export type Default = UUID
}
