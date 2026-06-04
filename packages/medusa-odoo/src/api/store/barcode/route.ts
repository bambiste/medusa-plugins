/**
 * POST /store/barcode/resolve
 *
 * Resolves a barcode for POS or warehouse context.
 * POS:       returns Medusa variant info + price
 * Warehouse: returns Odoo product info + stock levels
 *
 * Body: { barcode: string, context: 'pos'|'warehouse'|'receiving'|'stocktake' }
 */
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { BarcodeResolver } from '../../../modules/odoo-sync/barcode/barcode-resolver.js'
import type { OdooClient } from '../../../modules/odoo-sync/client/odoo-client.js'

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { barcode, context = 'pos' } = req.body as {
    barcode?: string
    context?: 'pos' | 'warehouse' | 'receiving' | 'stocktake'
  }

  if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
    return res.status(400).json({ error: 'barcode is required' })
  }

  const validContexts = ['pos', 'warehouse', 'receiving', 'stocktake']
  if (!validContexts.includes(context)) {
    return res.status(400).json({ error: `context must be one of: ${validContexts.join(', ')}` })
  }

  try {
    const odooClient  = req.scope.resolve<OdooClient>('odooClient')
    const redis       = req.scope.resolve('redis')
    const resolver    = new BarcodeResolver(req.scope, odooClient, redis)
    const start       = Date.now()
    const result      = await resolver.resolve(barcode.trim(), context)
    const latencyMs   = Date.now() - start

    if (!result) {
      return res.status(404).json({
        found:   false,
        barcode: barcode.trim(),
        context,
        latencyMs,
      })
    }

    return res.json({ found: true, latencyMs, ...result })
  } catch (err: any) {
    console.error('[barcode/resolve] Error:', err?.message)
    return res.status(500).json({ error: 'Barcode resolution failed' })
  }
}
