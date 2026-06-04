import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260514000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "product_extension" (
        "id"         text        NOT NULL,
        "product_id" text        NOT NULL,
        "videos"     jsonb       NOT NULL DEFAULT '[]',
        "tagline"    text        NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz NULL,
        CONSTRAINT "PK_product_extension" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_extension_product_id"
      ON "product_extension" ("product_id") WHERE deleted_at IS NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_product_extension_product_id";`);
    this.addSql(`DROP TABLE IF EXISTS "product_extension";`);
  }
}
