import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260516001000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "social_video" (
        "id"                text        NOT NULL,
        "social_account_id" text        NOT NULL,
        "external_id"       text        NOT NULL,
        "caption"           text        NULL,
        "thumbnail_url"     text        NULL,
        "video_url"         text        NULL,
        "embed_link"        text        NULL,
        "duration_seconds"  integer     NOT NULL DEFAULT 0,
        "metrics"           jsonb       NULL,
        "status"            text        NOT NULL DEFAULT 'active',
        "published_at"      timestamptz NULL,
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz NULL,
        CONSTRAINT "PK_social_video" PRIMARY KEY ("id"),
        CONSTRAINT "FK_social_video_account" FOREIGN KEY ("social_account_id")
          REFERENCES "social_account" ("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_social_video_account" ON "social_video" ("social_account_id");
      CREATE UNIQUE INDEX "UQ_social_video_ext" ON "social_video" ("social_account_id", "external_id") WHERE "deleted_at" IS NULL;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "social_video";`)
  }
}
