import { model } from '@medusajs/framework/utils'

export const ErpSyncLog = model.define('erp_sync_log', {
  id:              model.id().primaryKey(),
  entity_type:     model.text(),
  entity_id:       model.text(),
  operation:       model.text(),
  direction:       model.text(),
  status:          model.text(),
  trigger:         model.text(),
  idempotency_key: model.text().nullable(),
  duration_ms:     model.number().nullable(),
  error_message:   model.text().nullable(),
  error_code:      model.text().nullable(),
  odoo_id:         model.number().nullable(),
  odoo_model:      model.text().nullable(),
  attempt:         model.number().default(1),
  payload:         model.json().nullable(),
  started_at:      model.dateTime().nullable(),
  completed_at:    model.dateTime().nullable(),
  metadata:        model.json().nullable(),
}).indexes([
  { on: ['entity_type', 'entity_id'] },
  { on: ['status'] },
  { on: ['trigger'] },
])
