import { MedusaContainer } from '@medusajs/types'
import { Queue }            from 'bullmq'
import Redis                from 'ioredis'
import { OdooClient }       from '../client/odoo-client.js'
import { createProductWorker }      from '../workers/product.worker.js'
import { createInventoryWorker }    from '../workers/inventory.worker.js'
import { createOrderWorker }        from '../workers/order.worker.js'
import { createCustomerWorker }     from '../workers/customer.worker.js'
import { createOfflinePosWorker }   from '../workers/offline-pos.worker.js'
import { createBarcodeCacheWorker } from '../workers/barcode-cache.worker.js'
import { QUEUE, OdooPluginOptions } from '../types/index.js'

const ALL_QUEUES = [
  ...Object.values(QUEUE),
  'pos-offline-replay',
  'pos-session-close',
  'barcode-cache',
  'barcode-scan-log',
] as const

export default async function infrastructureLoader(
  {
    container,
    options: rawOptions,
  }: { container: MedusaContainer; options?: Record<string, unknown> },
) {
  const options = rawOptions as unknown as OdooPluginOptions
  // ── Odoo Client ─────────────────────────────────────────────────────────────
  const odooClient = new OdooClient({
    url:        options.odoo_url,
    db:         options.odoo_db,
    username:   options.odoo_username,
    password:   options.odoo_password,
    timeout:    options.odoo_timeout,
    rateLimit:  options.odoo_rate_limit,
  })
  container.register('odooClient', { resolve: () => odooClient })

  // ── Redis (shared ioredis instance) ─────────────────────────────────────────
  const redisUrl  = options.redis_url || process.env.REDIS_URL || 'redis://localhost:6379'
  const redisConn = new Redis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true })
  await redisConn.connect().catch((err: Error) => {
    console.warn('[medusa-odoo] Redis connect failed on boot:', err.message)
  })
  container.register('redis', { resolve: () => redisConn })

  // Silence BullMQ's per-queue eviction-policy warning (uses console.warn internally).
  // Filtered when Redis doesn't support CONFIG SET (Redis Enterprise, managed Redis).
  const origConsoleWarn = console.warn.bind(console)
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('IMPORTANT! Eviction policy')) return
    origConsoleWarn(...args)
  }

  // Build ioredis-compatible connection config for BullMQ
  const url        = new URL(redisUrl)
  const connection = {
    host:     url.hostname,
    port:     Number(url.port) || 6379,
    password: url.password || undefined,
    tls:      url.protocol === 'rediss:' ? {} : undefined,
  }

  // ── BullMQ Queues ───────────────────────────────────────────────────────────
  const queues: Record<string, Queue> = {}
  for (const name of ALL_QUEUES) {
    queues[name] = new Queue(name, { connection })
  }

  container.register('erpProductQueue',   { resolve: () => queues[QUEUE.PRODUCT] })
  container.register('erpInventoryQueue', { resolve: () => queues[QUEUE.INVENTORY] })
  container.register('erpOrderQueue',     { resolve: () => queues[QUEUE.ORDER] })
  container.register('erpCustomerQueue',  { resolve: () => queues[QUEUE.CUSTOMER] })
  container.register('erpInvoiceQueue',   { resolve: () => queues[QUEUE.INVOICE] })
  container.register('erpDlqQueue',       { resolve: () => queues[QUEUE.DLQ] })
  container.register('posOfflineQueue',   { resolve: () => queues['pos-offline-replay'] })
  container.register('barcodeCacheQueue', { resolve: () => queues['barcode-cache'] })
  container.register('erpQueues',         { resolve: () => queues })

  // The workers below run with this module-local container, where the main service
  // is registered under its camelCased class name (`odooSyncService`) — the module
  // key (`odooSync`) only exists in the global container. Alias it so the workers'
  // `container.resolve(ODOO_SYNC_MODULE)` resolves.
  container.register('odooSync', { resolve: () => container.resolve('odooSyncService') })

  // ── Workers ─────────────────────────────────────────────────────────────────
  // DISABLE_ERP_WORKERS=true → skip (used in Docker web container)
  // WORKER_MODE=erp|pos|barcode → start only that subset
  const disableWorkers = process.env.DISABLE_ERP_WORKERS === 'true' || process.env.NODE_ENV === 'test'
  const workerMode     = process.env.WORKER_MODE

  if (!disableWorkers) {
    if (!workerMode || workerMode === 'erp') {
      createProductWorker(connection, container)
      createInventoryWorker(connection, container)
      createOrderWorker(connection, container)
      createCustomerWorker(connection, container)
    }
    if (!workerMode || workerMode === 'pos') {
      createOfflinePosWorker(connection, container)
    }
    if (!workerMode || workerMode === 'barcode') {
      createBarcodeCacheWorker(connection, container)
    }
    console.log(`[medusa-odoo] Workers started (mode: ${workerMode || 'all'})`)
  }

  console.log('[medusa-odoo] Infrastructure loaded')
}
