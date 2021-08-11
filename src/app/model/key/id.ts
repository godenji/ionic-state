export type Id = string | number | bigint

/**
 * Id constructor
 *
 * usage:
 *
 * given a value type
 *
 * `Pk = (string | number | bigint) & { readonly __: unique symbol }`
 *
 * an instance can be created with `const id = Id<Pk>(2)` (or omit type parameter
 * if the type can be inferred).
 *
 * @param value primitive value
 * @returns T wrapped type
 */
export function Id<T extends Id>(value: Id): T {
  return value as T
}
