import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260516004000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "live_product" (
        "id"              text    NOT NULL,
        "live_session_id" text    NOT NULL,
        "variant_id"      text    NOT NULL,
        "allocated_stock" integer NOT NULL DEFAULT 0,
        "reserved_stock"  integer NOT NULL DEFAULT 0,
        "sold_stock"      integer NOT NULL DEFAULT 0,
        "is_featured"     boolean NOT NULL DEFAULT false,
        "display_order"   integer NOT NULL DEFAULT 0,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "updated_at"      timestamptz NOT NULL DEFAULT now(),
        "deleted_at"      timestamptz NULL,
        CONSTRAINT "PK_live_product" PRIMARY KEY ("id"),
        CONSTRAINT "FK_live_product_session" FOREIGN KEY ("live_session_id")
          REFERENCES "live_session" ("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_live_product_session_variant" UNIQUE ("live_session_id", "variant_id")
      );
      CREATE INDEX "IDX_live_product_session" ON "live_product" ("live_session_id");
      CREATE INDEX "IDX_live_product_variant" ON "live_product" ("variant_id");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "live_product";`)
  }
}
