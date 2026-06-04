import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { Queue } from 'bullmq'
import { QUEUE, ProductJobPayload } from '../modules/odoo-sync/types/index.js'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../modules/odoo-sync/index.js'
import crypto from 'crypto'

async function erpProductSubscriber({
  event: { name, data },
  container,
}: SubscriberArgs<Record<string, any>>) {
  const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
  const queue: Queue = syncService.resolveQueue('erpProductQueue')
  const productId: string = (data as any).id

  const operationMap: Record<string, 'create' | 'update' | 'delete'> = {
    'product.created':         'create',
    'product.updated':         'update',
    'product.deleted':         'delete',
    'product-variant.created': 'create',
    'product-variant.updated': 'update',
    'product-variant.deleted': 'delete',
  }
  const operation = operationMap[name] ?? 'update'
  const idempotency_key = `product:${productId}:${operation}:${Date.now()}`

  const payload: ProductJobPayload = {
    entity_type:     'product',
    medusa_id:       productId,
    operation,
    triggered_by:    'event',
    idempotency_key,
    data: data as any,
  }

  await queue.add(`product:${operation}`, payload, {
    jobId:   `${productId}_${operation}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  })
}

export const config: SubscriberConfig = {
  event: [
    'product.created',
    'product.updated',
    'product.deleted',
    'product-variant.created',
    'product-variant.updated',
    'product-variant.deleted',
  ],
}

export default erpProductSubscriber
