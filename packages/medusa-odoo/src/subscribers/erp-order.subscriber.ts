import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { Queue } from 'bullmq'
import { QUEUE, OrderJobPayload } from '../modules/odoo-sync/types/index.js'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../modules/odoo-sync/index.js'

async function erpOrderSubscriber({
  event: { name, data },
  container,
}: SubscriberArgs<Record<string, any>>) {
  const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
  const queue: Queue = syncService.resolveQueue('erpOrderQueue')
  const orderId: string = (data as any).id

  const operationMap: Record<string, 'create' | 'update' | 'delete'> = {
    'order.placed':    'create',
    'order.updated':   'update',
    'order.canceled':  'delete',
    'order.completed': 'update',
  }
  const operation = operationMap[name] ?? 'update'

  const payload: OrderJobPayload = {
    entity_type:     'order',
    medusa_id:       orderId,
    operation,
    triggered_by:    'event',
    idempotency_key: `order:${orderId}:${operation}:${Date.now()}`,
    data: data as any,
  }

  await queue.add(`order:${operation}`, payload, {
    jobId:   `${orderId}_${operation}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  })
}

export const config: SubscriberConfig = {
  event: ['order.placed', 'order.updated', 'order.canceled', 'order.completed'],
}

export default erpOrderSubscriber
