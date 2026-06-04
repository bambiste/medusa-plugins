import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../../../../modules/odoo-sync/index.js'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const syncService: OdooSyncService = req.scope.resolve(ODOO_SYNC_MODULE)
  const { entity_type, medusa_id, limit = '50', offset = '0' } = req.query as any

  const filters: Record<string, any> = {}
  if (entity_type) filters.entity_type = entity_type
  if (medusa_id)   filters.medusa_id   = medusa_id

  const mappings = await syncService.listErpMappings(filters as any)
  res.json({ mappings, count: Array.isArray(mappings) ? mappings.length : 0 })
}
