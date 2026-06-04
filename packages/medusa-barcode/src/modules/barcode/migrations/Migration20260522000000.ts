import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260522000000 extends Migration {
  override async up(): Promise<void> {
    // ── barcode_cache ──────────────────────────────────────────────────────

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "barcode_cache" (
        "id"              text          NOT NULL,
        "barcode"         text          NOT NULL,
        "provider"        text          NOT NULL,
        "raw_response"    jsonb         NOT NULL DEFAULT '{}',
        "normalized_data" jsonb         NULL,
        "expires_at"      timestamptz   NULL,
        "created_at"      timestamptz   NOT NULL DEFAULT now(),
        "updated_at"      timestamptz   NOT NULL DEFAULT now(),
        "deleted_at"      timestamptz   NULL,
        CONSTRAINT "PK_barcode_cache" PRIMARY KEY ("id")
      );
    `)

    // Composite index for the primary lookup pattern: barcode + provider
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_barcode_cache_barcode"
      ON "barcode_cache" ("barcode")
      WHERE deleted_at IS NULL;
    `)
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_barcode_cache_provider"
      ON "barcode_cache" ("provider")
      WHERE deleted_at IS NULL;
    `)
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_barcode_cache_barcode_provider"
      ON "barcode_cache" ("barcode", "provider")
      WHERE deleted_at IS NULL;
    `)
    // Partial index for fast "non-expired only" queries
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_barcode_cache_expires_at"
      ON "barcode_cache" ("expires_at")
      WHERE deleted_at IS NULL AND expires_at IS NOT NULL;
    `)

    // ── barcode_product ────────────────────────────────────────────────────

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "barcode_product" (
        "id"               text         NOT NULL,
        "barcode"          text         NOT NULL,
        "product_id"       text         NOT NULL,
        "variant_id"       text         NULL,
        "source_provider"  text         NULL,
        "confidence_score" real         NULL,
        "created_at"       timestamptz  NOT NULL DEFAULT now(),
        "updated_at"       timestamptz  NOT NULL DEFAULT now(),
        "deleted_at"       timestamptz  NULL,
        CONSTRAINT "PK_barcode_product" PRIMARY KEY ("id")
      );
    `)

    // One barcode → at most one product record (soft-delete aware)
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_barcode_product_barcode_unique"
      ON "barcode_product" ("barcode")
      WHERE deleted_at IS NULL;
    `)
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_barcode_product_product_id"
      ON "barcode_product" ("product_id")
      WHERE deleted_at IS NULL;
    `)
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_barcode_product_variant_id"
      ON "barcode_product" ("variant_id")
      WHERE deleted_at IS NULL AND variant_id IS NOT NULL;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_barcode_cache_barcode";`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_barcode_cache_provider";`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_barcode_cache_barcode_provider";`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_barcode_cache_expires_at";`)
    this.addSql(`DROP TABLE IF EXISTS "barcode_cache";`)

    this.addSql(`DROP INDEX IF EXISTS "IDX_barcode_product_barcode_unique";`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_barcode_product_product_id";`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_barcode_product_variant_id";`)
    this.addSql(`DROP TABLE IF EXISTS "barcode_product";`)
  }
}
