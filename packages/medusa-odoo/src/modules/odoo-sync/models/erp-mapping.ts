import { model } from '@medusajs/framework/utils'

export const ErpMapping = model.define('erp_mapping', {
  id:            model.id().primaryKey(),
  entity_type:   model.text(),
  medusa_id:     model.text(),
  odoo_id:       model.number(),
  odoo_model:    model.text(),
  sync_direction: model.text().default('bidirectional'),
  status:        model.text().default('active'),
  sync_version:  model.number().default(1),
  last_synced_at: model.dateTime().nullable(),
  metadata:      model.json().nullable(),
}).indexes([
  { on: ['entity_type', 'medusa_id'], unique: true },
  { on: ['entity_type', 'odoo_id'] },
  { on: ['status'] },
])
