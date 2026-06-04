import { Migration } from '@medusajs/framework/mikro-orm/migrations'

export class Migration20260516000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "social_account" (
        "id"                      text        NOT NULL,
        "merchant_id"             text        NOT NULL,
        "platform"                text        NOT NULL DEFAULT 'tiktok',
        "external_id"             text        NOT NULL,
        "username"                text        NOT NULL,
        "avatar_url"              text        NULL,
        "encrypted_access_token"  text        NOT NULL,
        "encrypted_refresh_token" text        NOT NULL,
        "token_scope"             text        NULL,
        "expires_at"              timestamptz NOT NULL,
        "follower_count"          integer     NOT NULL DEFAULT 0,
        "is_active"               boolean     NOT NULL DEFAULT true,
        "metadata"                jsonb       NULL,
        "created_at"              timestamptz NOT NULL DEFAULT now(),
        "updated_at"              timestamptz NOT NULL DEFAULT now(),
        "deleted_at"              timestamptz NULL,
        CONSTRAINT "PK_social_account" PRIMARY KEY ("id")
      );
      CREATE INDEX "IDX_social_account_merchant" ON "social_account" ("merchant_id");
      CREATE UNIQUE INDEX "UQ_social_account_platform_ext" ON "social_account" ("platform", "external_id") WHERE "deleted_at" IS NULL;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "social_account";`)
  }
}
