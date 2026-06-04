import { model } from '@medusajs/framework/utils'

export const ErpSyncFailure = model.define('erp_sync_failure', {
  id:             model.id().primaryKey(),
  queue:          model.text(),
  job_id:         model.text().nullable(),
  entity_type:    model.text(),
  entity_id:      model.text(),
  operation:      model.text(),
  direction:      model.text().default('medusa_to_odoo'),
  trigger:        model.text().default('event'),
  payload:        model.json(),
  error_message:  model.text(),
  error_code:     model.text().nullable(),
  error_stack:    model.text().nullable(),
  attempt_count:  model.number().default(1),
  next_retry_at:  model.dateTime().nullable(),
  resolved:       model.boolean().default(false),
  resolved_at:    model.dateTime().nullable(),
  resolved_by:    model.text().nullable(),
}).indexes([
  { on: ['entity_type', 'entity_id'] },
  { on: ['resolved'] },
  { on: ['next_retry_at'] },
])
