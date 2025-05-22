/**
 * @param item - An item to process
 * @returns The result of processing the item
 */
type ProcessItemAsync<T, R> = (item: T) => Promise<R>

/**
 * Maps each value of an array into an async function, then returns an array of the results.
 * Up to `poolSize` calls to the async function are allowed to run concurrently.
 * @param arr - Array of input values.
 * @param poolSize - Number of calls to `func` allowed to run concurrently.
 * If `poolSize` is less than 2, tasks will be run sequentially.
 * @param func - Function to apply to each item in `arr`.
 * @returns Results of `func` applied to each item in `arr`.
 */
export const poolMap = async <T, R>(arr: T[], poolSize: number, func: ProcessItemAsync<T, R>): Promise<R[]> => {
  const pool: Record<number, Promise<void>> = []
  const results: R[] = []

  const processItem = async (i: number): Promise<void> => {
    results[i] = await func(arr[i])
    delete pool[i]
  }

  for (let i = 0; i < arr.length; i++) {
    pool[i] = processItem(i) // No `await` here: we're storing the promise, not the result
    if (Object.keys(pool).length >= poolSize) {
      // Wait for one of the promises in the pool to resolve
      // and clear itself to make room for the next one
      await Promise.race(Object.values(pool))
    }
  }

  // Wait for any remaining promises to resolve
  await Promise.all(Object.values(pool))
  return results
}
