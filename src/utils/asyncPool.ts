/**
 * Asynchronous pool
 * @param concurrency
 * @param iterable
 * @param iteratorFn
 */
export async function* asyncPool(
  concurrency = 10,
  iterable: AsyncIterable<any> | Iterable<any>,
  iteratorFn: (item: any, iterable: any) => Promise<any>,
): AsyncGenerator<any> {
  const executing = new Set<Promise<any>>();
  async function consume(): Promise<any> {
    const [promise, value] = await Promise.race(executing);
    executing.delete(promise);
    return value;
  }
  for await (const item of iterable) {
    // Wrap iteratorFn() in an async fn to ensure we get a promise.
    // Then expose the promise, so it's possible to later reference and
    // remove it from the executing pool.
    const promise = (async (): Promise<[any, any]> => await iteratorFn(item, iterable))().then((value) => [
      promise,
      value,
    ]);
    executing.add(promise);
    if (executing.size >= concurrency) {
      yield await consume();
    }
  }
  while (executing.size) {
    yield await consume();
  }
}
