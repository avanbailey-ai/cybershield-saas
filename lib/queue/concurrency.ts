/**

 * Run async tasks with a fixed concurrency limit (stateless worker batches).

 * Concurrency is clamped to 1–3 for scan worker safety.

 */



const MIN_CONCURRENCY = 1;

const MAX_CONCURRENCY = 3;



export function clampWorkerConcurrency(concurrency: number): number {

  if (!Number.isFinite(concurrency) || concurrency < MIN_CONCURRENCY) {

    return MIN_CONCURRENCY;

  }

  return Math.min(Math.floor(concurrency), MAX_CONCURRENCY);

}



export async function runWithConcurrency<T>(

  items: T[],

  concurrency: number,

  fn: (item: T) => Promise<void>,

): Promise<void> {

  if (items.length === 0) return;



  const limit = clampWorkerConcurrency(concurrency);

  let index = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {

    while (index < items.length) {

      const current = items[index++];

      await fn(current);

    }

  });



  await Promise.all(workers);

}


