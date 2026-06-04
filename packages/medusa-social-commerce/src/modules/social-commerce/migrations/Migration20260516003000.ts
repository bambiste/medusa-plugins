import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260516003000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "social_product" (
        "id"                text    NOT NULL,
        "social_video_id"   text    NOT NULL,
        "product_id"        text    NOT NULL,
        "variant_id"        text    NULL,
        "timestamp_seconds" integer NULL,
        "display_order"     integer NOT NULL DEFAULT 0,
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz NULL,
        CONSTRAINT "PK_social_product" PRIMARY KEY ("id"),
        CONSTRAINT "FK_social_product_video" FOREIGN KEY ("social_video_id")
          REFERENCES "social_video" ("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_social_product_video" ON "social_product" ("social_video_id");
      CREATE INDEX "IDX_social_product_product" ON "social_product" ("product_id");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "social_product";`)
  }
}
