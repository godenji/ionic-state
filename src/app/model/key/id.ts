export abstract class Id {
  static key = 'id'

  constructor(readonly value: string | number) {}

  toString(): string {
    return `${this.value}`
  }
}
