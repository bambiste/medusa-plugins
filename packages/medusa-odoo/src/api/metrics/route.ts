/**
 * GET /metrics
 * Prometheus scrape endpoint, exposes default Node.js process metrics
 * plus any leuzman_* metrics registered via shared-observability.
 *
 * Mount this in the plugin's api/index.ts router.
 */
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { register } from 'prom-client'

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  res.set('Content-Type', register.contentType)
  res.send(await register.metrics())
}
