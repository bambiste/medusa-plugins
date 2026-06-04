import { Worker, Job } from 'bullmq'
import { QUEUE } from '../types/index.js'

interface OfflineReplayItem {
  variantId:      string
  quantity:       number
  unitPriceCents: number
}

interface OfflineReplayPayload {
  transactionId:  string
  deviceId:       string
  sessionId:      string
  items:          OfflineReplayItem[]
  customerEmail?: string
  customerId?:    string
  totalCents:     number
  currency:       string
  paymentMethod:  string
  paymentData?:   Record<string, unknown>
  capturedAt:     string
}

export function createOfflinePosWorker(connection: any, container: any) {
  const worker = new Worker<OfflineReplayPayload>(
    'pos-offline-replay',
    async (job: Job<OfflineReplayPayload>) => {
      const logger = console  // replace with shared-observability logger in production
      const { transactionId, items, customerEmail, customerId, totalCents, currency } = job.data

      logger.log(`[offline-pos] Replaying transaction ${transactionId}`)

      // 1. Resolve or create customer in Medusa
      const cartModule = container.resolve('cart')
      const customerModule = container.resolve('customer')
      const orderModule = container.resolve('order')

      let resolvedCustomerId = customerId
      if (!resolvedCustomerId && customerEmail) {
        const customers = await customerModule.listCustomers({ email: customerEmail }, { take: 1 })
        resolvedCustomerId = customers[0]?.id
      }

      // 2. Create Medusa cart from offline items
      const cart = await cartModule.createCarts({
        currency_code: currency.toLowerCase(),
        customer_id: resolvedCustomerId,
        email: customerEmail,
        items: items.map(item => ({
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: item.unitPriceCents / 100,
        })),
      })

      // 3. Complete cart → create order
      const order = await orderModule.createOrdersFromCart(cart.id)

      logger.log(`[offline-pos] Transaction ${transactionId} → Medusa order ${order.id}`)
      return { orderId: order.id, cartId: cart.id }
    },
    {
      connection,
      concurrency: 3,
    },
  )

  worker.on('completed', (job, result) => {
    console.log(`[offline-pos] Job ${job.id} completed → order ${result.orderId}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[offline-pos] Job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('[erp-worker:offline-pos] Worker error:', err.message)
  })

  return worker
}
