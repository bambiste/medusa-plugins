import { model } from '@medusajs/framework/utils'

export const ErpInventorySnapshot = model.define('erp_inventory_snapshot', {
  id:                       model.id().primaryKey(),
  product_id:               model.text(),
  variant_id:               model.text(),
  location_id:              model.text(),
  odoo_location_id:         model.number().nullable(),
  quantity_medusa:          model.number().default(0),
  quantity_odoo:            model.number().default(0),
  snapshot_at:              model.dateTime(),
  reconciled:               model.boolean().default(false),
  reconciled_at:            model.dateTime().nullable(),
  drift_threshold_exceeded: model.boolean().default(false),
  metadata:                 model.json().nullable(),
}).indexes([
  { on: ['variant_id'] },
  { on: ['location_id'] },
  { on: ['reconciled'] },
])
