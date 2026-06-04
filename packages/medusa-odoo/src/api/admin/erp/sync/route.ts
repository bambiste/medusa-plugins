import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { Queue } from 'bullmq'
import { QUEUE } from '../../../../modules/odoo-sync/types/index.js'

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { entity_type, medusa_id, operation = 'update' } = req.body as any
  if (!entity_type || !medusa_id) {
    return res.status(400).json({ error: 'entity_type and medusa_id are required' })
  }

  const queueMap: Record<string, string> = {
    product:   QUEUE.PRODUCT,
    variant:   QUEUE.PRODUCT,
    order:     QUEUE.ORDER,
    customer:  QUEUE.CUSTOMER,
    inventory: QUEUE.INVENTORY,
  }
  const queueName = queueMap[entity_type]
  if (!queueName) {
    return res.status(400).json({ error: `Unknown entity_type: ${entity_type}` })
  }

  const queues: Record<string, Queue> = req.scope.resolve('erpQueues')
  const queue = queues[queueName]

  const idempotency_key = `manual:${entity_type}:${medusa_id}:${Date.now()}`
  await queue.add(`${entity_type}:${operation}`, {
    entity_type,
    medusa_id,
    operation,
    triggered_by:    'manual',
    idempotency_key,
  }, {
    jobId:   `manual_${medusa_id}_${Date.now()}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  })

  res.json({ success: true, queue: queueName, idempotency_key })
}
