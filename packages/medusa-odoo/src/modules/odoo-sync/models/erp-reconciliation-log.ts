import { model } from '@medusajs/framework/utils'

export const ErpReconciliationLog = model.define('erp_reconciliation_log', {
  id:                  model.id().primaryKey(),
  reconciliation_type: model.text(),
  triggered_by:        model.text(),
  started_at:          model.dateTime(),
  completed_at:        model.dateTime().nullable(),
  status:              model.text().default('running'),
  total_checked:       model.number().default(0),
  total_matched:       model.number().default(0),
  total_drifted:       model.number().default(0),
  total_fixed:         model.number().default(0),
  total_conflicts:     model.number().default(0),
  error_message:       model.text().nullable(),
  report:              model.json().nullable(),
}).indexes([
  { on: ['reconciliation_type'] },
  { on: ['status'] },
])
