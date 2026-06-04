import { Worker, Job } from 'bullmq'
import { ProductJobPayload, QUEUE } from '../types/index.js'
import { OdooClient } from '../client/odoo-client.js'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../index.js'

export function createProductWorker(
  connection: { host: string; port: number } | any,
  container: any,
) {
  const worker = new Worker<ProductJobPayload>(
    QUEUE.PRODUCT,
    async (job: Job<ProductJobPayload>) => {
      const { entity_type, medusa_id, operation, idempotency_key, data } = job.data
      const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
      const odooClient: OdooClient = container.resolve('odooClient')
      const startedAt = Date.now()

      try {
        let odooId: number | null = null

        if (operation === 'delete') {
          odooId = await syncService.getOdooId('product', medusa_id)
          if (odooId) {
            await odooClient.write('product.template', [odooId], { active: false })
          }
        } else {
          const productData = data as any
          const vals = {
            name:             productData.title || 'Untitled',
            description_sale: productData.description || '',
            type:             'product',
            medusa_product_id: medusa_id,
            medusa_synced:    true,
            medusa_sync_date: new Date().toISOString(),
          }
          odooId = await odooClient.upsertProduct(medusa_id, vals)

          // sync variants
          if (productData.variants?.length) {
            for (const variant of productData.variants) {
              const variantVals = {
                default_code:      variant.sku || '',
                barcode:           variant.barcode || false,
                list_price:        (variant.prices?.[0]?.amount || 0) / 100,
                medusa_variant_id: variant.id,
                medusa_product_id: medusa_id,
                medusa_synced:     true,
              }
              await odooClient.upsertVariant(variant.id, variantVals)
            }
          }
        }

        await syncService.upsertMapping('product', medusa_id, odooId ?? 0, 'medusa_to_odoo')
        await syncService.logSync({
          entity_type: 'product',
          entity_id:   medusa_id,
          operation,
          direction:   'medusa_to_odoo',
          status:      'success',
          trigger:     job.data.triggered_by,
          idempotency_key,
          duration_ms: Date.now() - startedAt,
          odoo_id:     odooId ?? undefined,
          attempt:     job.attemptsMade + 1,
        })
      } catch (err: any) {
        await syncService.logSync({
          entity_type:   'product',
          entity_id:     medusa_id,
          operation,
          direction:     'medusa_to_odoo',
          status:        'failed',
          trigger:       job.data.triggered_by,
          idempotency_key,
          duration_ms:   Date.now() - startedAt,
          error_message: err.message,
          attempt:       job.attemptsMade + 1,
        })
        throw err
      }
    },
    { connection, concurrency: 5 },
  )

  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= 3) {
      const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
      await syncService.recordFailure({
        queue:         QUEUE.PRODUCT,
        job_id:        job.id,
        entity_type:   'product',
        entity_id:     job.data.medusa_id,
        operation:     job.data.operation,
        payload:       job.data as any,
        error_message: err.message,
        error_stack:   err.stack,
        attempt_count: job.attemptsMade,
      })
    }
  })

  worker.on('error', (err) => {
    console.error('[erp-worker:product] Worker error:', err.message)
  })

  return worker
}
