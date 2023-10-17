/**
 * Funciton should work like throttle and debounce at the same time:
 * - if there are no waiting, just call given function and start waiting
 * - if there are waiting and subsequent calls, just run function once after waiting
 * - if there are waiting and no subsequent calls, just do nothing
 */
export function throttleDebounce(func: Function, wait: number) {
  let timeout: any;
  let waitingCount = 0;
  let lastArgs: any[];
  let lastThis: any;

  function wrapped(...args: any[]) {
    lastArgs = args;
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
