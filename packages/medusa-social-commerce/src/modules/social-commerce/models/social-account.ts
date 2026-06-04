import { model } from '@medusajs/framework/utils'

export const SocialAccount = model.define('social_account', {
  id:                      model.id().primaryKey(),
  merchant_id:             model.text(),
  platform:                model.enum(['tiktok']),
  external_id:             model.text(),
  username:                model.text(),
  avatar_url:              model.text().nullable(),
  encrypted_access_token:  model.text(),
  encrypted_refresh_token: model.text(),
  token_scope:             model.text().nullable(),
  expires_at:              model.dateTime(),
  follower_count:          model.number().default(0),
  is_active:               model.boolean().default(true),
  metadata:                model.json().nullable(),
})
.indexes([
  { on: ['merchant_id'] },
  { on: ['platform', 'external_id'], unique: true },
])
