import { model } from '@medusajs/framework/utils'

export const SocialVideo = model.define('social_video', {
  id:                  model.id().primaryKey(),
  social_account_id:   model.text(),
  external_id:         model.text(),
  caption:             model.text().nullable(),
  thumbnail_url:       model.text().nullable(),
  video_url:           model.text().nullable(),
  embed_link:          model.text().nullable(),
  duration_seconds:    model.number().default(0),
  metrics:             model.json().nullable(),
  status:              model.enum(['active', 'deleted', 'private']).default('active'),
  published_at:        model.dateTime().nullable(),
})
.indexes([
  { on: ['social_account_id'] },
  { on: ['social_account_id', 'external_id'], unique: true },
])
