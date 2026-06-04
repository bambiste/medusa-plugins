import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SOCIAL_COMMERCE_MODULE } from '../../../../modules/social-commerce/index';
import type { ISocialCommerceService } from '../../../../modules/social-commerce/services/social-commerce.service';

/**
 * GET /admin/social/videos
 *
 * Lists synced TikTok videos with optional filtering and pagination.
 * Supports cursor-based pagination (pass `cursor` instead of `offset`) in
 * addition to standard offset/limit.
 *
 * Query params:
 *   account_id? — filter by social account id
 *   status?     — filter by video status (e.g. "active", "archived")
 *   limit?      — page size (default 20)
 *   offset?     — numeric page offset (default 0)
 *   cursor?     — opaque cursor string (takes precedence over offset when provided)
 *
 * Response:
 *   { videos: SocialVideo[], count: number }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const { account_id, status, limit, offset, cursor } = req.query as {
      account_id?: string
      status?:     string
      limit?:      string
      offset?:     string
      cursor?:     string
    }

    const filter: Record<string, unknown> = {}
    if (account_id) filter.social_account_id = account_id
    if (status)     filter.status            = status

    const take = parseInt(limit ?? "20", 10)
    // cursor (stringified integer offset) takes precedence over the offset param
    const skip = cursor
      ? parseInt(cursor, 10)
      : parseInt(offset ?? "0", 10)

    let videos: any[]
    let count: number

    if (typeof (svc as any).listAndCountSocialVideos === "function") {
      ;[videos, count] = await (svc as any).listAndCountSocialVideos(filter, {
        take,
        skip,
        order: { published_at: "DESC" },
      })
    } else {
      videos = await (svc as any).listSocialVideos(filter, {
        take,
        skip,
        order: { published_at: "DESC" },
      })
      count = videos.length
    }

    res.json({ videos, count })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Internal error" })
  }
}
