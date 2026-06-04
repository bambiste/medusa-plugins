import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260516002000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "live_session" (
        "id"                text        NOT NULL,
        "social_account_id" text        NOT NULL,
        "external_id"       text        NOT NULL,
        "title"             text        NULL,
        "status"            text        NOT NULL DEFAULT 'live',
        "started_at"        timestamptz NULL,
        "ended_at"          timestamptz NULL,
        "viewer_count"      integer     NOT NULL DEFAULT 0,
        "peak_viewer_count" integer     NOT NULL DEFAULT 0,
        "metrics"           jsonb       NULL,
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz NULL,
        CONSTRAINT "PK_live_session" PRIMARY KEY ("id"),
        CONSTRAINT "FK_live_session_account" FOREIGN KEY ("social_account_id")
          REFERENCES "social_account" ("id") ON DELETE CASCADE
      );
      CREATE INDEX "IDX_live_session_account" ON "live_session" ("social_account_id");
      CREATE INDEX "IDX_live_session_status" ON "live_session" ("status");
      CREATE UNIQUE INDEX "UQ_live_session_ext" ON "live_session" ("social_account_id", "external_id") WHERE "deleted_at" IS NULL;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "live_session";`)
  }
}
