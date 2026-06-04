import { model } from '@medusajs/framework/utils'

export const LiveProduct = model.define('live_product', {
  id:               model.id().primaryKey(),
  live_session_id:  model.text(),
  variant_id:       model.text(),
  allocated_stock:  model.number().default(0),
  reserved_stock:   model.number().default(0),
  sold_stock:       model.number().default(0),
  is_featured:      model.boolean().default(false),
  display_order:    model.number().default(0),
})
.indexes([
  { on: ['live_session_id'] },
  { on: ['variant_id'] },
  { on: ['live_session_id', 'variant_id'], unique: true },
])
