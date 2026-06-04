import { Worker, Job } from 'bullmq'
import { CustomerJobPayload, QUEUE } from '../types/index.js'
import { OdooClient } from '../client/odoo-client.js'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../index.js'

export function createCustomerWorker(connection: any, container: any) {
  const worker = new Worker<CustomerJobPayload>(
    QUEUE.CUSTOMER,
    async (job: Job<CustomerJobPayload>) => {
      const { medusa_id, operation, triggered_by, idempotency_key, data } = job.data
      const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
      const odooClient: OdooClient = container.resolve('odooClient')
      const startedAt = Date.now()
      const customer = data as any

      try {
        let odooId: number | null = null

        if (operation !== 'delete') {
          const vals = {
            name:          `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
            email:         customer.email || '',
            phone:         customer.phone || false,
            customer_rank: 1,
            medusa_customer_id: medusa_id,
          }
          odooId = await odooClient.upsertCustomer(medusa_id, vals)
        }

        if (odooId) await syncService.upsertMapping('customer', medusa_id, odooId, 'medusa_to_odoo')
        await syncService.logSync({
          entity_type: 'customer', entity_id: medusa_id, operation,
          direction: 'medusa_to_odoo', status: 'success', trigger: triggered_by,
          idempotency_key, duration_ms: Date.now() - startedAt, odoo_id: odooId ?? undefined,
          attempt: job.attemptsMade + 1,
        })
      } catch (err: any) {
        await syncService.logSync({
          entity_type: 'customer', entity_id: medusa_id, operation,
          direction: 'medusa_to_odoo', status: 'failed', trigger: triggered_by,
          idempotency_key, duration_ms: Date.now() - startedAt, error_message: err.message,
          attempt: job.attemptsMade + 1,
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
        queue: QUEUE.CUSTOMER, job_id: job.id,
        entity_type: 'customer', entity_id: job.data.medusa_id,
        operation: job.data.operation, payload: job.data as any,
        error_message: err.message, error_stack: err.stack,
        attempt_count: job.attemptsMade,
      })
    }
  })

  worker.on('error', (err) => {
    console.error('[erp-worker:customer] Worker error:', err.message)
  })

  return worker
}
