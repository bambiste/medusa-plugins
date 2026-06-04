import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Add ean13_value column to store the raw 13-digit EAN-13 number for fast
 * barcode scanner lookups (separate from the ean13 image URL column).
 */
export class Migration20260501000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE IF EXISTS "qr"
      ADD COLUMN IF NOT EXISTS "ean13_value" text NULL;
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_qr_ean13_value"
      ON "qr" ("ean13_value") WHERE deleted_at IS NULL;
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_qr_resource"
      ON "qr" ("resource_type", "resource_id") WHERE deleted_at IS NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_qr_ean13_value";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_qr_resource";`);
    this.addSql(`ALTER TABLE IF EXISTS "qr" DROP COLUMN IF EXISTS "ean13_value";`);
  }
}
