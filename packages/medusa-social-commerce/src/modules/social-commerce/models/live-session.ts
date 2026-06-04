import { model } from '@medusajs/framework/utils'

export const LiveSession = model.define('live_session', {
  id:                model.id().primaryKey(),
  social_account_id: model.text(),
  external_id:       model.text(),
  title:             model.text().nullable(),
  status:            model.enum(['live', 'ended', 'scheduled']).default('live'),
  started_at:        model.dateTime().nullable(),
  ended_at:          model.dateTime().nullable(),
  viewer_count:      model.number().default(0),
  peak_viewer_count: model.number().default(0),
  metrics:           model.json().nullable(),
})
.indexes([
  { on: ['social_account_id'] },
  { on: ['social_account_id', 'external_id'], unique: true },
  { on: ['status'] },
])
