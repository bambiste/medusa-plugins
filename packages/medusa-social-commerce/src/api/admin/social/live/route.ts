import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SOCIAL_COMMERCE_MODULE } from '../../../../modules/social-commerce/index';
import type { ISocialCommerceService } from '../../../../modules/social-commerce/services/social-commerce.service';

/**
 * GET /admin/social/live
 *
 * Lists live-shopping sessions with optional filtering and pagination.
 *
 * Query params:
 *   account_id? — filter by social account id
 *   status?     — filter by session status ("live", "ended", "scheduled")
 *   limit?      — page size (default 20)
 *   offset?     — page offset (default 0)
 *
 * Response:
 *   { sessions: LiveSession[], count: number }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const { account_id, status, limit, offset } = req.query as {
      account_id?: string
      status?:     string
      limit?:      string
      offset?:     string
    }

    const filter: Record<string, unknown> = {}
    if (account_id) filter.social_account_id = account_id
    if (status)     filter.status            = status

    const take = parseInt(limit  ?? "20", 10)
    const skip = parseInt(offset ?? "0",  10)

    let sessions: any[]
    let count: number

    if (typeof (svc as any).listAndCountLiveSessions === "function") {
      ;[sessions, count] = await (svc as any).listAndCountLiveSessions(filter, {
        take,
        skip,
        order: { started_at: "DESC" },
      })
    } else {
      sessions = await svc.listLiveSessions(filter, {
        take,
        skip,
        order: { started_at: "DESC" },
      })
      count = sessions.length
    }

    res.json({ sessions, count })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Internal error" })
  }
}
