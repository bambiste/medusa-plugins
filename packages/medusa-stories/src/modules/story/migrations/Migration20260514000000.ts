import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260514000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "story" (
        "id"            text        NOT NULL,
        "title"         text        NOT NULL,
        "media_type"    text        NOT NULL DEFAULT 'image',
        "media_url"     text        NOT NULL,
        "thumbnail_url" text        NULL,
        "link_url"      text        NULL,
        "link_text"     text        NULL,
        "is_active"     boolean     NOT NULL DEFAULT true,
        "display_order" integer     NOT NULL DEFAULT 0,
        "expires_at"    timestamptz NULL,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        "deleted_at"    timestamptz NULL,
        CONSTRAINT "PK_story" PRIMARY KEY ("id")
      );
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "story";`);
  }
}
