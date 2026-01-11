/**
 * Debounce utility for function calls
 */

/**
 * Creates a debounced function that delays invoking the provided function
 * until after wait milliseconds have elapsed since the last time it was invoked
 * 
 * @param func Function to debounce
 * @param wait Milliseconds to wait
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Creates a debounced function that returns a promise
 * The promise resolves when the function is finally called
 * 
 * @param func Function to debounce
 * @param wait Milliseconds to wait
 * @returns Debounced function that returns a promise
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: NodeJS.Timeout | null = null;
  let resolvePromise: ((value: ReturnType<T>) => void) | null = null;
  let rejectPromise: ((reason?: any) => void) | null = null;

  return function debounced(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        if (rejectPromise) {
          rejectPromise(new Error("Debounce cancelled"));
        }
      }

      resolvePromise = resolve;
      rejectPromise = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          if (resolvePromise) {
            resolvePromise(result);
          }
        } catch (error) {
          if (rejectPromise) {
            rejectPromise(error);
          }
        } finally {
          timeoutId = null;
          resolvePromise = null;
          rejectPromise = null;
        }
      }, wait);
    });
  };
}

