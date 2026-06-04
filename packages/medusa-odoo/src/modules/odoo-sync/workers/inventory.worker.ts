import { Worker, Job } from 'bullmq'
import { InventoryJobPayload, QUEUE } from '../types/index.js'
import { OdooClient } from '../client/odoo-client.js'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../index.js'

export function createInventoryWorker(
  connection: any,
  container: any,
) {
  const worker = new Worker<InventoryJobPayload>(
    QUEUE.INVENTORY,
    async (job: Job<InventoryJobPayload>) => {
      const { variant_id, location_id, quantity, medusa_id, operation, triggered_by, idempotency_key } = job.data
      const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
      const odooClient: OdooClient = container.resolve('odooClient')
      const startedAt = Date.now()

      try {
        // get odoo product id from variant mapping
        const odooProductId = await syncService.getOdooId('variant', variant_id)
        if (!odooProductId) throw new Error(`No Odoo mapping found for variant ${variant_id}`)

        // find odoo location
        let odooLocationId: number | null = null
        if (location_id) {
          const locs = await odooClient.search<{ id: number }>(
            'stock.location',
            [['medusa_location_id', '=', location_id]],
            ['id'],
            1,
          )
          odooLocationId = locs[0]?.id ?? null
        }
        if (!odooLocationId) {
          // fallback: use default internal location
          const locs = await odooClient.search<{ id: number }>(
            'stock.location',
            [['usage', '=', 'internal'], ['active', '=', true]],
            ['id'],
            1,
          )
          odooLocationId = locs[0]?.id ?? null
        }
        if (!odooLocationId) throw new Error('No suitable Odoo stock location found')

        await odooClient.updateStockQuantity(odooProductId, odooLocationId, quantity ?? 0)

        await syncService.logSync({
          entity_type: 'inventory',
          entity_id:   medusa_id,
          operation,
          direction:   'medusa_to_odoo',
          status:      'success',
          trigger:     triggered_by,
          idempotency_key,
          duration_ms: Date.now() - startedAt,
          attempt:     job.attemptsMade + 1,
        })
      } catch (err: any) {
        await syncService.logSync({
          entity_type:   'inventory',
          entity_id:     medusa_id,
          operation,
          direction:     'medusa_to_odoo',
          status:        'failed',
          trigger:       triggered_by,
          idempotency_key,
          duration_ms:   Date.now() - startedAt,
          error_message: err.message,
          attempt:       job.attemptsMade + 1,
        })
        throw err
      }
    },
    { connection, concurrency: 10 },
  )

  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= 5) {
      const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
      await syncService.recordFailure({
        queue: QUEUE.INVENTORY, job_id: job.id,
        entity_type: 'inventory', entity_id: job.data.medusa_id,
        operation: job.data.operation, payload: job.data as any,
        error_message: err.message, error_stack: err.stack,
        attempt_count: job.attemptsMade,
      })
    }
  })

  worker.on('error', (err) => {
    console.error('[erp-worker:inventory] Worker error:', err.message)
  })

  return worker
}
