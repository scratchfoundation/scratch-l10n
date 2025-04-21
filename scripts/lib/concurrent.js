/**
 * @template T, R
 * @callback ProcessItemAsync - Process a single item asynchronously
 * @param {T} item - An item to process
 * @returns {Promise<R>} - The result of processing the item
 */

/**
 * Maps each value of an array into an async function, then returns an array of the results.
 * Up to `poolSize` calls to the async function are allowed to run concurrently.
 * @template T, R
 * @param {T[]} arr - Array of input values.
 * @param {number} poolSize - Number of calls to `func` allowed to run concurrently.
 * If `poolSize` is less than 2, tasks will be run sequentially.
 * @param {ProcessItemAsync.<T,R>} func - Function to apply to each item in `arr`.
 * @return {Promise<R[]>} - Results of `func` applied to each item in `arr`.
 */
exports.poolMap = async (arr, poolSize, func) => {
    const pool = [];
    const results = [];

    const processItem = async i => {
        results[i] = await func(arr[i]);
        delete pool[i];
    };

    for (let i = 0; i < arr.length; i++) {
        pool[i] = processItem(i); // No `await` here: we're storing the promise, not the result
        if (Object.keys(pool).length >= poolSize) {
            // Wait for one of the promises in the pool to resolve
            // and clear itself to make room for the next one
            await Promise.race(Object.values(pool));
        }
    }

    // Wait for any remaining promises to resolve
    await Promise.all(Object.values(pool));
    return results;
};
