/**
 * Scheduled job: warm the barcode Redis cache nightly at 02:00.
 * Enqueues a 'warmAll' job into the barcode:cache queue so the
 * dedicated barcode-worker container handles the actual work.
 */
import { MedusaContainer } from '@medusajs/types'
import type { Queue }       from 'bullmq'

export default async function barcodeCacheWarmup(container: MedusaContainer) {
  const queue: Queue = container.resolve('barcodeCacheQueue')
  await queue.add(
    'warmAll',
    { type: 'warmAll' },
    {
      jobId:           `barcode-warmall-${new Date().toISOString().slice(0, 10)}`,
      removeOnComplete: 10,
      removeOnFail:     20,
    }
  )
  console.log('[barcode-cache-warmup] warmAll job enqueued')
}

export const config = {
  name: 'barcode-cache-warmup',
  // 02:00 every day
  schedule: '0 2 * * *',
}
