import { model } from '@medusajs/framework/utils'

export const ErpConflictResolution = model.define('erp_conflict_resolution', {
  id:                  model.id().primaryKey(),
  entity_type:         model.text(),
  entity_id:           model.text(),
  field_name:          model.text(),
  medusa_value:        model.json().nullable(),
  odoo_value:          model.json().nullable(),
  resolved_value:      model.json().nullable(),
  resolution_strategy: model.text().default('pending'),
  auto_resolved:       model.boolean().default(false),
  resolved_at:         model.dateTime().nullable(),
  resolved_by:         model.text().nullable(),
  notes:               model.text().nullable(),
}).indexes([
  { on: ['entity_type', 'entity_id'] },
  { on: ['resolution_strategy'] },
])
