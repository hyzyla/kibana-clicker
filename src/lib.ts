/**
 * Funciton should work like throttle and debounce at the same time:
 * - if there are no waiting, just call given function and start waiting
 * - if there are waiting and subsequent calls, just run function once after waiting
 * - if there are waiting and no subsequent calls, just do nothing
 */
export function throttleDebounce(
  func: (...args: unknown[]) => void,
  wait: number
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let waitingCount = 0;
  let lastArgs: unknown[];
  let lastThis: unknown;

  function wrapped(this: unknown, ...args: unknown[]) {
    lastArgs = args;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastThis = this;

    if (timeout) {
      waitingCount += 1;
      return;
    }

    func.apply(lastThis, lastArgs);

    // Start waiting
    timeout = setTimeout(() => {
      timeout = null;

      // If there are waiting calls, run function again after waiting
      if (waitingCount !== 0) {
        waitingCount = 0;
        wrapped.apply(lastThis, lastArgs);
      }
    }, wait);
  }

  return wrapped;
}
