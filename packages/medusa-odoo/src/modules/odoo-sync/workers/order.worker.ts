import { Worker, Job } from 'bullmq'
import { OrderJobPayload, QUEUE } from '../types/index.js'
import { OdooClient } from '../client/odoo-client.js'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../index.js'

export function createOrderWorker(connection: any, container: any) {
  const worker = new Worker<OrderJobPayload>(
    QUEUE.ORDER,
    async (job: Job<OrderJobPayload>) => {
      const { medusa_id, operation, triggered_by, idempotency_key, data } = job.data
      const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
      const odooClient: OdooClient = container.resolve('odooClient')
      const startedAt = Date.now()

      try {
        let odooId: number | null = null
        const order = data as any

        if (operation === 'delete') {
          const existing = await odooClient.getOrderByMedusaId(medusa_id)
          if (existing) {
            await odooClient.write('sale.order', [existing.id], { state: 'cancel' })
            odooId = existing.id
          }
        } else {
          const existingOrder = await odooClient.getOrderByMedusaId(medusa_id)
          if (existingOrder && operation === 'create') {
            odooId = existingOrder.id
          } else {
            // find or create partner
            const email = order.email || ''
            let partners = await odooClient.search<{ id: number }>(
              'res.partner',
              [['email', '=', email]],
              ['id'],
              1,
            )
            let partnerId = partners[0]?.id
            if (!partnerId) {
              const addr = order.shipping_address || order.billing_address || {}
              partnerId = await odooClient.create('res.partner', {
                name:          `${addr.first_name || ''} ${addr.last_name || ''}`.trim() || email,
                email,
                customer_rank: 1,
                medusa_customer_id: order.customer_id,
              })
            }

            const lines: Array<{product_id: number; product_uom_qty: number; price_unit: number; name: string}> = []
            for (const item of (order.items || [])) {
              const sku = item.variant?.sku
              const variantMedusaId = item.variant_id
              const products = await odooClient.search<{ id: number }>(
                'product.product',
                ['|', ['default_code', '=', sku], ['medusa_variant_id', '=', variantMedusaId]],
                ['id'],
                1,
              )
              if (products[0]) {
                lines.push({
                  product_id: products[0].id,
                  product_uom_qty: item.quantity || 1,
                  price_unit: (item.unit_price || 0) / 100,
                  name: item.title || '',
                })
              }
            }

            odooId = await odooClient.createSaleOrder(
              {
                partner_id:       partnerId,
                medusa_order_id:  medusa_id,
                client_order_ref: order.display_id || medusa_id,
                note:             `MedusaJS order. ID: ${medusa_id}`,
              },
              lines,
            )
          }
        }

        if (odooId) await syncService.upsertMapping('order', medusa_id, odooId, 'medusa_to_odoo')
        await syncService.logSync({
          entity_type: 'order', entity_id: medusa_id, operation,
          direction: 'medusa_to_odoo', status: 'success', trigger: triggered_by,
          idempotency_key, duration_ms: Date.now() - startedAt, odoo_id: odooId ?? undefined,
          attempt: job.attemptsMade + 1,
        })
      } catch (err: any) {
        await syncService.logSync({
          entity_type: 'order', entity_id: medusa_id, operation,
          direction: 'medusa_to_odoo', status: 'failed', trigger: triggered_by,
          idempotency_key, duration_ms: Date.now() - startedAt, error_message: err.message,
          attempt: job.attemptsMade + 1,
        })
        throw err
      }
    },
    { connection, concurrency: 3 },
  )

  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= 3) {
      const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
      await syncService.recordFailure({
        queue: QUEUE.ORDER, job_id: job.id,
        entity_type: 'order', entity_id: job.data.medusa_id,
        operation: job.data.operation, payload: job.data as any,
        error_message: err.message, error_stack: err.stack,
        attempt_count: job.attemptsMade,
      })
    }
  })

  worker.on('error', (err) => {
    console.error('[erp-worker:order] Worker error:', err.message)
  })

  return worker
}
