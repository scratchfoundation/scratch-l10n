/**
 * Helper class to log progress.
 */
export class ProgressLogger {
  total?: number
  completed: number
  percent?: number

  /**
   * @param [total] - Optional: expected total number of items to process.
   */
  constructor(total?: number) {
    this.total = total
    this.completed = 0
    this.percent = 0
  }

  /**
   * Set the expected total number of items to process.
   * @param total - Total number of items to process.
   */
  setTotal(total: number) {
    if (this.total !== total) {
      this.total = total
      delete this.percent
    }
  }

  /**
   * Increment the number of items processed and log progress.
   * If a total is set, progress is logged as a percentage and only when the percentage changes.
   * If no total is set, progress is logged as a count.
   * @param [count] - Number of items processed.
   */
  increment(count = 1) {
    this.completed += count
    if (this.total) {
      const percent = Math.floor((100 * this.completed) / this.total)
      if (percent !== this.percent) {
        this.percent = percent
        console.info(`Progress: ${this.percent}% (${this.completed}/${this.total})`)
      }
    } else {
      console.info(`Progress: ${this.completed} of unknown total`)
    }
  }
}
