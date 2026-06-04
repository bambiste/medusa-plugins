import { MedusaContainer } from '@medusajs/types'
import { OdooSyncService, ODOO_SYNC_MODULE } from '../modules/odoo-sync/index.js'

export default async function erpReconciliationJob(container: MedusaContainer) {
  const syncService: OdooSyncService = container.resolve(ODOO_SYNC_MODULE)
  await syncService.runReconciliation()
}

export const config = {
  name:     'erp-reconciliation',
  schedule: '0 3 * * *', // daily at 03:00
}
