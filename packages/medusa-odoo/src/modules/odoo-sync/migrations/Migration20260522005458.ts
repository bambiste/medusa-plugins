import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260522005458 extends Migration {

  override async up(): Promise<void> {
    // ── erp_mapping ──────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "erp_mapping" (
        "id"             text        not null,
        "entity_type"    text        not null,
        "medusa_id"      text        not null,
        "odoo_id"        integer     not null,
        "odoo_model"     text        not null,
        "sync_direction" text        not null default 'bidirectional',
        "status"         text        not null default 'active',
        "sync_version"   integer     not null default 1,
        "last_synced_at" timestamptz null,
        "metadata"       jsonb       null,
        "created_at"     timestamptz not null default now(),
        "updated_at"     timestamptz not null default now(),
        "deleted_at"     timestamptz null,
        constraint "erp_mapping_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_mapping_deleted_at" ON "erp_mapping" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_erp_mapping_entity_type_medusa_id_unique" ON "erp_mapping" ("entity_type", "medusa_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_mapping_entity_type_odoo_id" ON "erp_mapping" ("entity_type", "odoo_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_mapping_status" ON "erp_mapping" ("status") WHERE deleted_at IS NULL;`);

    // ── erp_sync_log ─────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "erp_sync_log" (
        "id"              text        not null,
        "entity_type"     text        not null,
        "entity_id"       text        not null,
        "operation"       text        not null,
        "direction"       text        not null,
        "status"          text        not null,
        "trigger"         text        not null,
        "idempotency_key" text        null,
        "duration_ms"     integer     null,
        "error_message"   text        null,
        "error_code"      text        null,
        "odoo_id"         integer     null,
        "odoo_model"      text        null,
        "attempt"         integer     not null default 1,
        "payload"         jsonb       null,
        "started_at"      timestamptz null,
        "completed_at"    timestamptz null,
        "metadata"        jsonb       null,
        "created_at"      timestamptz not null default now(),
        "updated_at"      timestamptz not null default now(),
        "deleted_at"      timestamptz null,
        constraint "erp_sync_log_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_sync_log_deleted_at" ON "erp_sync_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_sync_log_entity_type_entity_id" ON "erp_sync_log" ("entity_type", "entity_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_sync_log_status" ON "erp_sync_log" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_sync_log_trigger" ON "erp_sync_log" ("trigger") WHERE deleted_at IS NULL;`);

    // ── erp_sync_failure ─────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "erp_sync_failure" (
        "id"             text        not null,
        "queue"          text        not null,
        "job_id"         text        null,
        "entity_type"    text        not null,
        "entity_id"      text        not null,
        "operation"      text        not null,
        "direction"      text        not null default 'medusa_to_odoo',
        "trigger"        text        not null default 'event',
        "payload"        jsonb       not null,
        "error_message"  text        not null,
        "error_code"     text        null,
        "error_stack"    text        null,
        "attempt_count"  integer     not null default 1,
        "next_retry_at"  timestamptz null,
        "resolved"       boolean     not null default false,
        "resolved_at"    timestamptz null,
        "resolved_by"    text        null,
        "created_at"     timestamptz not null default now(),
        "updated_at"     timestamptz not null default now(),
        "deleted_at"     timestamptz null,
        constraint "erp_sync_failure_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_sync_failure_deleted_at" ON "erp_sync_failure" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_sync_failure_entity_type_entity_id" ON "erp_sync_failure" ("entity_type", "entity_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_sync_failure_resolved" ON "erp_sync_failure" ("resolved") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_sync_failure_next_retry_at" ON "erp_sync_failure" ("next_retry_at") WHERE deleted_at IS NULL;`);

    // ── erp_inventory_snapshot ───────────────────────────────────────────────
    this.addSql(`
      create table if not exists "erp_inventory_snapshot" (
        "id"                       text        not null,
        "product_id"               text        not null,
        "variant_id"               text        not null,
        "location_id"              text        not null,
        "odoo_location_id"         integer     null,
        "quantity_medusa"          integer     not null default 0,
        "quantity_odoo"            integer     not null default 0,
        "snapshot_at"              timestamptz not null,
        "reconciled"               boolean     not null default false,
        "reconciled_at"            timestamptz null,
        "drift_threshold_exceeded" boolean     not null default false,
        "metadata"                 jsonb       null,
        "created_at"               timestamptz not null default now(),
        "updated_at"               timestamptz not null default now(),
        "deleted_at"               timestamptz null,
        constraint "erp_inventory_snapshot_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_inventory_snapshot_deleted_at" ON "erp_inventory_snapshot" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_inventory_snapshot_variant_id" ON "erp_inventory_snapshot" ("variant_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_inventory_snapshot_location_id" ON "erp_inventory_snapshot" ("location_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_inventory_snapshot_reconciled" ON "erp_inventory_snapshot" ("reconciled") WHERE deleted_at IS NULL;`);

    // ── erp_reconciliation_log ───────────────────────────────────────────────
    this.addSql(`
      create table if not exists "erp_reconciliation_log" (
        "id"                  text        not null,
        "reconciliation_type" text        not null,
        "triggered_by"        text        not null,
        "started_at"          timestamptz not null,
        "completed_at"        timestamptz null,
        "status"              text        not null default 'running',
        "total_checked"       integer     not null default 0,
        "total_matched"       integer     not null default 0,
        "total_drifted"       integer     not null default 0,
        "total_fixed"         integer     not null default 0,
        "total_conflicts"     integer     not null default 0,
        "error_message"       text        null,
        "report"              jsonb       null,
        "created_at"          timestamptz not null default now(),
        "updated_at"          timestamptz not null default now(),
        "deleted_at"          timestamptz null,
        constraint "erp_reconciliation_log_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_reconciliation_log_deleted_at" ON "erp_reconciliation_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_reconciliation_log_reconciliation_type" ON "erp_reconciliation_log" ("reconciliation_type") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_reconciliation_log_status" ON "erp_reconciliation_log" ("status") WHERE deleted_at IS NULL;`);

    // ── erp_conflict_resolution ──────────────────────────────────────────────
    this.addSql(`
      create table if not exists "erp_conflict_resolution" (
        "id"                  text        not null,
        "entity_type"         text        not null,
        "entity_id"           text        not null,
        "field_name"          text        not null,
        "medusa_value"        jsonb       null,
        "odoo_value"          jsonb       null,
        "resolved_value"      jsonb       null,
        "resolution_strategy" text        not null default 'pending',
        "auto_resolved"       boolean     not null default false,
        "resolved_at"         timestamptz null,
        "resolved_by"         text        null,
        "notes"               text        null,
        "created_at"          timestamptz not null default now(),
        "updated_at"          timestamptz not null default now(),
        "deleted_at"          timestamptz null,
        constraint "erp_conflict_resolution_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_conflict_resolution_deleted_at" ON "erp_conflict_resolution" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_conflict_resolution_entity_type_entity_id" ON "erp_conflict_resolution" ("entity_type", "entity_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_erp_conflict_resolution_resolution_strategy" ON "erp_conflict_resolution" ("resolution_strategy") WHERE deleted_at IS NULL;`);

    // ── offline_pos_transaction ──────────────────────────────────────────────
    this.addSql(`
      create table if not exists "offline_pos_transaction" (
        "id"                   text        not null,
        "device_id"            text        not null,
        "session_id"           text        not null,
        "pos_location_id"      text        null,
        "cart_id"              text        null,
        "status"               text        not null default 'pending',
        "items"                jsonb       not null,
        "customer_email"       text        null,
        "customer_id"          text        null,
        "subtotal_cents"       integer     not null default 0,
        "tax_cents"            integer     not null default 0,
        "total_cents"          integer     not null default 0,
        "currency"             text        not null default 'USD',
        "payment_method"       text        null,
        "payment_data"         jsonb       null,
        "discount_code"        text        null,
        "discount_cents"       integer     not null default 0,
        "captured_at"          timestamptz not null,
        "replayed_at"          timestamptz null,
        "replay_attempt_count" integer     not null default 0,
        "last_replay_at"       timestamptz null,
        "next_replay_at"       timestamptz null,
        "replay_error"         text        null,
        "medusa_order_id"      text        null,
        "odoo_order_id"        integer     null,
        "metadata"             jsonb       null,
        "created_at"           timestamptz not null default now(),
        "updated_at"           timestamptz not null default now(),
        "deleted_at"           timestamptz null,
        constraint "offline_pos_transaction_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_offline_pos_transaction_deleted_at" ON "offline_pos_transaction" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_offline_pos_transaction_status" ON "offline_pos_transaction" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_offline_pos_transaction_device_id" ON "offline_pos_transaction" ("device_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_offline_pos_transaction_session_id" ON "offline_pos_transaction" ("session_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_offline_pos_transaction_next_replay_at" ON "offline_pos_transaction" ("next_replay_at") WHERE deleted_at IS NULL;`);

    // ── barcode_scan_log ─────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "barcode_scan_log" (
        "id"                    text        not null,
        "barcode"               text        not null,
        "context"               text        not null,
        "device_id"             text        null,
        "session_id"            text        null,
        "operator_id"           text        null,
        "variant_id"            text        null,
        "odoo_product_id"       integer     null,
        "resolution_status"     text        not null default 'resolved',
        "resolution_latency_ms" integer     null,
        "action_taken"          text        null,
        "quantity"              integer     null,
        "location_id"           text        null,
        "scan_timestamp"        timestamptz not null,
        "metadata"              jsonb       null,
        "created_at"            timestamptz not null default now(),
        "updated_at"            timestamptz not null default now(),
        "deleted_at"            timestamptz null,
        constraint "barcode_scan_log_pkey" primary key ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_barcode_scan_log_deleted_at" ON "barcode_scan_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_barcode_scan_log_barcode" ON "barcode_scan_log" ("barcode") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_barcode_scan_log_context" ON "barcode_scan_log" ("context") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_barcode_scan_log_device_id" ON "barcode_scan_log" ("device_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_barcode_scan_log_resolution_status" ON "barcode_scan_log" ("resolution_status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "barcode_scan_log" cascade;`);
    this.addSql(`drop table if exists "erp_conflict_resolution" cascade;`);
    this.addSql(`drop table if exists "erp_inventory_snapshot" cascade;`);
    this.addSql(`drop table if exists "erp_mapping" cascade;`);
    this.addSql(`drop table if exists "erp_reconciliation_log" cascade;`);
    this.addSql(`drop table if exists "erp_sync_failure" cascade;`);
    this.addSql(`drop table if exists "erp_sync_log" cascade;`);
    this.addSql(`drop table if exists "offline_pos_transaction" cascade;`);
  }
}
