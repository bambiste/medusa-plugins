import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../../../../modules/odoo-sync/index.js'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const syncService: OdooSyncService = req.scope.resolve(ODOO_SYNC_MODULE)
  const { resolved = 'false' } = req.query as any
  const failures = await syncService.listErpSyncFailures(
    { resolved: resolved === 'true' } as any,
  )
  res.json({ failures, count: Array.isArray(failures) ? failures.length : 0 })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.body as any
  if (!id) return res.status(400).json({ error: 'id is required' })
  const syncService: OdooSyncService = req.scope.resolve(ODOO_SYNC_MODULE)
  await syncService.resolveFailure(id)
  res.json({ success: true })
}
