import { Module } from '@medusajs/framework/utils'
import OdooSyncService from './services/odoo-sync-service.js'
import infrastructureLoader from './loaders/infrastructure.js'

export const ODOO_SYNC_MODULE = 'odooSync'

export default Module(ODOO_SYNC_MODULE, {
  service: OdooSyncService,
  loaders: [infrastructureLoader],
})

export { default as OdooSyncService } from './services/odoo-sync-service.js'
export * from './models/erp-mapping.js'
export * from './models/erp-sync-log.js'
export * from './models/erp-sync-failure.js'
export * from './models/erp-inventory-snapshot.js'
export * from './models/erp-reconciliation-log.js'
export * from './models/erp-conflict-resolution.js'
export * from './models/offline-pos-transaction.js'
export * from './models/barcode-scan-log.js'
