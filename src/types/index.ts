export type ExcludesUndefined = <T>(x: T | undefined) => x is T;
type Truthy<T> = T extends false | "" | 0 | null | undefined ? never : T; // from lodash

export type Enumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

export type IntRange<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>;

export function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

export function truthy<T>(value: T): value is Truthy<T> {
  return !!value;
}
