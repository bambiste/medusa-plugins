import { model } from '@medusajs/framework/utils'

export const SocialProduct = model.define('social_product', {
  id:                  model.id().primaryKey(),
  social_video_id:     model.text(),
  product_id:          model.text(),
  variant_id:          model.text().nullable(),
  timestamp_seconds:   model.number().nullable(),
  display_order:       model.number().default(0),
})
.indexes([
  { on: ['social_video_id'] },
  { on: ['product_id'] },
])
