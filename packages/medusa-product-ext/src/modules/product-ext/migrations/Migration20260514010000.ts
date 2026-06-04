import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260514010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "variant_extension" (
        "id"         text        NOT NULL,
        "variant_id" text        NOT NULL,
        "videos"     jsonb       NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "PK_variant_extension" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_variant_extension_variant_id"
      ON "variant_extension" ("variant_id") WHERE deleted_at IS NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_variant_extension_variant_id";`);
    this.addSql(`DROP TABLE IF EXISTS "variant_extension";`);
  }
}
