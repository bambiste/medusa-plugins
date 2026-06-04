import { MedusaService } from '@medusajs/framework/utils'
import { Queue } from 'bullmq'
import { ErpMapping }             from '../models/erp-mapping.js'
import { ErpSyncLog }             from '../models/erp-sync-log.js'
import { ErpSyncFailure }         from '../models/erp-sync-failure.js'
import { ErpInventorySnapshot }   from '../models/erp-inventory-snapshot.js'
import { ErpReconciliationLog }   from '../models/erp-reconciliation-log.js'
import { ErpConflictResolution }  from '../models/erp-conflict-resolution.js'
import { OfflinePosTransaction }  from '../models/offline-pos-transaction.js'
import { BarcodeScanLog }         from '../models/barcode-scan-log.js'

class OdooSyncService extends MedusaService({
  ErpMapping,
  ErpSyncLog,
  ErpSyncFailure,
  ErpInventorySnapshot,
  ErpReconciliationLog,
  ErpConflictResolution,
  OfflinePosTransaction,
  BarcodeScanLog,
}) {
  private container_: Record<string, any>

  constructor(container: Record<string, any>) {
    super(...arguments as any)
    this.container_ = container
  }

  // ─── Module-scope DI helpers (safe to call from jobs/subscribers) ─────────

  resolveQueue(name: string): Queue {
    return this.container_[name] as Queue
  }

  // ─── ERP reconciliation (moved from job so odooClient is in scope) ────────

  async runReconciliation(): Promise<void> {
    const odooClient = this.container_['odooClient'] as any
    console.log('[medusa-odoo] Starting ERP reconciliation job')
    try {
      const mappings = await this.listErpMappings({ entity_type: 'variant' } as any)
      for (const mapping of mappings) {
        try {
          const quants: { quantity: number; reserved_quantity: number }[] = await odooClient.search(
            'stock.quant',
            [['product_id', '=', mapping.odoo_id], ['location_id.usage', '=', 'internal']],
            ['quantity', 'reserved_quantity'],
            1,
          )
          const odooQty = Math.max(0, (quants[0]?.quantity ?? 0) - (quants[0]?.reserved_quantity ?? 0))
          await this.createErpInventorySnapshots({
            product_id:       '',
            variant_id:       mapping.medusa_id,
            location_id:      '',
            odoo_location_id: null,
            quantity_medusa:  0,
            quantity_odoo:    odooQty,
            reconciled:       false,
            snapshot_at:      new Date(),
          })
        } catch (err: any) {
          console.error('[medusa-odoo] Reconciliation error for variant', mapping.medusa_id, err.message)
        }
      }
      console.log(`[medusa-odoo] Reconciliation done: ${mappings.length} variants processed`)
    } catch (err: any) {
      console.error('[medusa-odoo] Reconciliation job failed:', err.message)
    }
  }
  // ─── Log a sync attempt ──────────────────────────────────────────────────

  async logSync(data: {
    entity_type:     string
    entity_id:       string
    operation:       string
    direction:       string
    status:          string
    trigger:         string
    idempotency_key?: string
    duration_ms?:    number
    error_message?:  string
    error_code?:     string
    odoo_id?:        number
    odoo_model?:     string
    attempt?:        number
    payload?:        Record<string, unknown>
    started_at?:     Date
    completed_at?:   Date
    metadata?:       Record<string, unknown>
  }) {
    return this.createErpSyncLogs({
      ...data,
      started_at:   data.started_at   ?? new Date(),
      completed_at: data.completed_at ?? (data.status !== 'running' ? new Date() : undefined),
    })
  }

  // ─── Upsert ID mapping ────────────────────────────────────────────────────

  async upsertMapping(
    entity_type:     string,
    medusa_id:       string,
    odoo_id:         number,
    direction:       string,
    odoo_model?:     string,
    metadata?:       Record<string, unknown>,
  ) {
    const existing = await this.listErpMappings({ entity_type, medusa_id } as any)

    if (existing.length) {
      return this.updateErpMappings({ entity_type, medusa_id } as any, {
        odoo_id,
        odoo_model:     odoo_model ?? existing[0].odoo_model,
        status:         'active',
        last_synced_at: new Date(),
        metadata,
      })
    }

    return this.createErpMappings({
      entity_type,
      medusa_id,
      odoo_id,
      odoo_model:     odoo_model ?? '',
      sync_direction: direction,
      status:         'active',
      last_synced_at: new Date(),
      metadata,
    })
  }

  // ─── Resolve Odoo ID for a Medusa entity ──────────────────────────────────

  async getOdooId(entity_type: string, medusa_id: string): Promise<number | null> {
    const rows = await this.listErpMappings({ entity_type, medusa_id } as any)
    return rows[0]?.odoo_id ?? null
  }

  // ─── Resolve Medusa ID from Odoo ID ───────────────────────────────────────

  async getMedusaId(entity_type: string, odoo_id: number): Promise<string | null> {
    const rows = await this.listErpMappings({ entity_type, odoo_id } as any)
    return rows[0]?.medusa_id ?? null
  }

  // ─── Record a failed job ──────────────────────────────────────────────────

  async recordFailure(data: {
    queue:          string
    job_id?:        string
    entity_type:    string
    entity_id:      string
    operation:      string
    direction?:     string
    trigger?:       string
    payload:        Record<string, unknown>
    error_message:  string
    error_code?:    string
    error_stack?:   string
    attempt_count?: number
  }) {
    return this.createErpSyncFailures({
      ...data,
      direction:     data.direction     ?? 'medusa_to_odoo',
      trigger:       data.trigger       ?? 'event',
      attempt_count: data.attempt_count ?? 1,
    })
  }

  // ─── Mark a failure as resolved ───────────────────────────────────────────

  async resolveFailure(id: string, resolved_by = 'manual') {
    return this.updateErpSyncFailures({ id } as any, {
      resolved:    true,
      resolved_at: new Date(),
      resolved_by,
    })
  }

  // ─── Start / complete a reconciliation run ────────────────────────────────

  async startReconciliation(type: string, triggered_by: string) {
    return this.createErpReconciliationLogs({
      reconciliation_type: type,
      triggered_by,
      started_at:          new Date(),
      status:              'running',
    })
  }

  async completeReconciliation(
    id: string,
    result: {
      status:          string
      total_checked:   number
      total_matched:   number
      total_drifted:   number
      total_fixed:     number
      total_conflicts: number
      error_message?:  string
      report?:         Record<string, unknown>
    },
  ) {
    return this.updateErpReconciliationLogs({ id } as any, {
      ...result,
      completed_at: new Date(),
    })
  }

  // ─── Log a barcode scan ───────────────────────────────────────────────────

  async logBarcodeScan(data: {
    barcode:                string
    context:                string
    device_id?:             string
    session_id?:            string
    operator_id?:           string
    variant_id?:            string
    odoo_product_id?:       number
    resolution_status?:     string
    resolution_latency_ms?: number
    action_taken?:          string
    quantity?:              number
    location_id?:           string
    metadata?:              Record<string, unknown>
  }) {
    return this.createBarcodeScanLogs({
      ...data,
      resolution_status: data.resolution_status ?? 'resolved',
      scan_timestamp:    new Date(),
    })
  }

  // ─── Offline POS transaction helpers ─────────────────────────────────────

  async createOfflineTransaction(data: {
    device_id:        string
    session_id:       string
    pos_location_id?: string
    items:            Record<string, unknown>[]
    customer_email?:  string
    customer_id?:     string
    subtotal_cents:   number
    tax_cents:        number
    total_cents:      number
    currency?:        string
    payment_method?:  string
    payment_data?:    Record<string, unknown>
    discount_code?:   string
    discount_cents?:  number
    captured_at:      Date
    metadata?:        Record<string, unknown>
  }) {
    return this.createOfflinePosTransactions({
      ...data,
      items:          data.items as unknown as Record<string, unknown>,
      status:         'pending',
      currency:       data.currency       ?? 'USD',
      discount_cents: data.discount_cents ?? 0,
    })
  }

  async markTransactionReplayed(id: string, medusa_order_id: string, odoo_order_id?: number) {
    return this.updateOfflinePosTransactions({ id } as any, {
      status:          'replayed',
      replayed_at:     new Date(),
      medusa_order_id,
      odoo_order_id,
    })
  }

  async markTransactionFailed(id: string, error: string, next_retry_at?: Date) {
    const txn = await this.listOfflinePosTransactions({ id } as any)
    return this.updateOfflinePosTransactions({ id } as any, {
      status:               'failed',
      replay_error:         error,
      replay_attempt_count: (txn[0]?.replay_attempt_count ?? 0) + 1,
      last_replay_at:       new Date(),
      next_retry_at,
    })
  }
}

export default OdooSyncService
