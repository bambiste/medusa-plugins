import { model } from '@medusajs/framework/utils'

export const BarcodeScanLog = model.define('barcode_scan_log', {
  id:                    model.id().primaryKey(),
  barcode:               model.text(),
  context:               model.text(),
  device_id:             model.text().nullable(),
  session_id:            model.text().nullable(),
  operator_id:           model.text().nullable(),
  variant_id:            model.text().nullable(),
  odoo_product_id:       model.number().nullable(),
  resolution_status:     model.text().default('resolved'),
  resolution_latency_ms: model.number().nullable(),
  action_taken:          model.text().nullable(),
  quantity:              model.number().nullable(),
  location_id:           model.text().nullable(),
  scan_timestamp:        model.dateTime(),
  metadata:              model.json().nullable(),
}).indexes([
  { on: ['barcode'] },
  { on: ['context'] },
  { on: ['device_id'] },
  { on: ['resolution_status'] },
])
