import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import crypto from 'crypto'
import { Queue } from 'bullmq'
import { QUEUE } from '../../../modules/odoo-sync/types/index.js'

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // HMAC verification
  const secret = process.env.ODOO_WEBHOOK_SECRET
  if (secret) {
    const sig = (req.headers['x-odoo-signature'] as string) || ''
    const raw = JSON.stringify(req.body)
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid signature' })
    }
  }

  const { event, data } = req.body as any
  if (!event || !data) return res.status(400).json({ error: 'Missing event or data' })

  const queues: Record<string, Queue> = req.scope.resolve('erpQueues')

  // Route to appropriate queue for odoo → medusa handling
  // (For now we log, full odoo→medusa would call Medusa Admin SDK)
  console.log(`[medusa-odoo] Odoo webhook received: ${event}`, data?.id)

  res.json({ received: true, event })
}
