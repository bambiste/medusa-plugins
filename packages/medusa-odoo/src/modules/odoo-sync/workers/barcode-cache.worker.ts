/**
 * barcode-cache worker, keeps the Redis barcode cache warm.
 *
 * Jobs arrive on queue 'barcode:cache' with payload:
 *   { type: 'warmAll' }          rebuild entire cache (scheduled nightly)
 *   { type: 'invalidate', barcode, context? }, bust specific entry on product update
 *   { type: 'warmSingle', barcode }, resolve and cache a single barcode
 */
import { Worker, Job } from 'bullmq'
import { BarcodeResolver, type BarcodeContext } from '../barcode/barcode-resolver.js'
import type { OdooClient } from '../client/odoo-client.js'

interface BarcodeCachePayload {
  type:     'warmAll' | 'invalidate' | 'warmSingle'
  barcode?: string
  context?: BarcodeContext
}

export function createBarcodeCacheWorker(connection: any, container: any) {
  const worker = new Worker<BarcodeCachePayload>(
    'barcode-cache',
    async (job: Job<BarcodeCachePayload>) => {
      const odooClient: OdooClient = container.resolve('odooClient')
      const redis                  = container.resolve('redis')
      const resolver               = new BarcodeResolver(container, odooClient, redis)

      switch (job.data.type) {
        case 'warmAll': {
          // Fetch all active variant SKUs from Medusa and warm their cache
          const productModule = container.resolve('productModuleService') as any
          const variants = await productModule.listProductVariants({}, { select: ['sku', 'id'], take: 2000 })
          const barcodes  = variants.map((v: any) => v.sku).filter(Boolean)
          const result    = await resolver.warmCache(barcodes)
          console.log(`[barcode-cache] Warm all: ${result.warmed} warmed, ${result.failed} failed`)
          return result
        }

        case 'invalidate': {
          if (!job.data.barcode) throw new Error('barcode required for invalidate')
          await resolver.invalidate(job.data.barcode, job.data.context)
          console.log(`[barcode-cache] Invalidated ${job.data.barcode}`)
          return { invalidated: job.data.barcode }
        }

        case 'warmSingle': {
          if (!job.data.barcode) throw new Error('barcode required for warmSingle')
          const result = await resolver.resolve(job.data.barcode, 'pos')
          return { found: !!result, barcode: job.data.barcode }
        }

        default:
          throw new Error(`Unknown barcode cache job type: ${(job.data as any).type}`)
      }
    },
    { connection, concurrency: 2 }
  )

  worker.on('failed', (job, err) => {
    console.error(`[barcode-cache] Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[erp-worker:barcode-cache] Worker error:', err.message)
  })

  return worker
}
