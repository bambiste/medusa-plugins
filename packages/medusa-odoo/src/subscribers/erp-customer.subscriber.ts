import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { Queue } from 'bullmq'
import { QUEUE, CustomerJobPayload } from '../modules/odoo-sync/types/index.js'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../modules/odoo-sync/index.js'

async function erpCustomerSubscriber({
  event: { name, data },
  container,
}: SubscriberArgs<Record<string, any>>) {
  const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
  const queue: Queue = syncService.resolveQueue('erpCustomerQueue')
  const customer = data as any

  const operationMap: Record<string, 'create' | 'update' | 'delete'> = {
    'customer.created': 'create',
    'customer.updated': 'update',
    'customer.deleted': 'delete',
  }
  const operation = operationMap[name] ?? 'update'

  const payload: CustomerJobPayload = {
    entity_type:     'customer',
    medusa_id:       customer.id,
    operation,
    triggered_by:    'event',
    idempotency_key: `customer:${customer.id}:${operation}:${Date.now()}`,
    data: customer,
  }

  await queue.add(`customer:${operation}`, payload, {
    jobId:   `${customer.id}_${operation}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  })
}

export const config: SubscriberConfig = {
  event: ['customer.created', 'customer.updated', 'customer.deleted'],
}

export default erpCustomerSubscriber
