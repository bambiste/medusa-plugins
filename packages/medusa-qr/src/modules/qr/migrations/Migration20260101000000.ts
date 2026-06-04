import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260101000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "qr" (
        "id"              text        NOT NULL,
        "code"            text        NOT NULL,
        "resource_type"   text        NOT NULL,
        "resource_id"     text        NOT NULL,
        "type"            text        NOT NULL DEFAULT 'dynamic',
        "action"          text        NOT NULL DEFAULT 'view',
        "payload"         jsonb       NOT NULL DEFAULT '{}',
        "qr_code"         text        NOT NULL DEFAULT '',
        "code128"         text        NULL,
        "ean13"           text        NULL,
        "ean13_value"     text        NULL,
        "scan_count"      integer     NOT NULL DEFAULT 0,
        "last_scanned_at" timestamptz NULL,
        "expires_at"      timestamptz NULL,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "updated_at"      timestamptz NOT NULL DEFAULT now(),
        "deleted_at"      timestamptz NULL,
        CONSTRAINT "PK_qr" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_qr_code_unique"
      ON "qr" ("code") WHERE deleted_at IS NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_qr_code_unique";`);
    this.addSql(`DROP TABLE IF EXISTS "qr";`);
  }
}
