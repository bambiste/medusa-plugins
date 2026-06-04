import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { Queue } from 'bullmq'
import { QUEUE, InventoryJobPayload } from '../modules/odoo-sync/types/index.js'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../modules/odoo-sync/index.js'

async function erpInventorySubscriber({
  event: { name, data },
  container,
}: SubscriberArgs<Record<string, any>>) {
  const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
  const queue: Queue = syncService.resolveQueue('erpInventoryQueue')
  const inv = data as any

  const payload: InventoryJobPayload = {
    entity_type:     'inventory',
    medusa_id:       inv.id || inv.inventory_item_id,
    variant_id:      inv.variant_id || inv.id,
    location_id:     inv.location_id,
    quantity:        inv.stocked_quantity ?? inv.quantity,
    operation:       'update',
    triggered_by:    'event',
    idempotency_key: `inventory:${inv.id}:${Date.now()}`,
  }

  await queue.add('inventory:update', payload, {
    jobId:   `inv_${inv.id}_${inv.location_id}`,
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 200,
    removeOnFail:     50,
  })
}

export const config: SubscriberConfig = {
  event: [
    'inventory-item.updated',
    'inventory-level.updated',
    'inventory-level.created',
  ],
}

export default erpInventorySubscriber
