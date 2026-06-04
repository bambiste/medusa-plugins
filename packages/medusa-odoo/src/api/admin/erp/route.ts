import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { OdooClient } from '../../../modules/odoo-sync/client/odoo-client.js'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../../../modules/odoo-sync/index.js'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const odooClient: OdooClient = req.scope.resolve('odooClient')
  const syncService: OdooSyncService = req.scope.resolve(ODOO_SYNC_MODULE)

  const healthy = await odooClient.healthCheck()
  const [mappings, failures] = await Promise.all([
    syncService.listErpMappings({} as any, { take: 0 } as any),
    syncService.listErpSyncFailures({ resolved: false } as any, { take: 0 } as any),
  ])

  res.json({
    status:           healthy ? 'connected' : 'disconnected',
    total_mappings:   (mappings as any).count ?? 0,
    open_failures:    (failures as any).count ?? 0,
    timestamp:        new Date().toISOString(),
  })
}
