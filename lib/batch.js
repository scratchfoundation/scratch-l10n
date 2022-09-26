/**
 * Maps each value of an array into an async function, and returns an array of the results
 * @param {array} arr - array of values
 * @param {number} batchSize - number of calls to `func` to do at one time
 * @param {function} func - async function to apply to all items in `arr`. Function should take one argument.
 * @return {Promise<array>} - results of `func` applied to each item in `arr`
 */
exports.batchMap = async (arr, batchSize, func) => {
    const results = [];
    for (let i = 0; i < arr.length; i += batchSize) {
        const result = await Promise.all(
            arr.slice(i, i + batchSize).map(func)
        );
        results.push(...result);
    }
    return results;
};
