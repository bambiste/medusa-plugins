import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SOCIAL_COMMERCE_MODULE } from "../../../../modules/social-commerce/index"
import type { ISocialCommerceService } from "../../../../modules/social-commerce/services/social-commerce.service"

/**
 * GET /admin/social/accounts
 *
 * Lists all connected social accounts with optional filtering and pagination.
 *
 * Query params:
 *   platform?, filter by platform (e.g. "tiktok")
 *   status?    filter by status / is_active state
 *   limit?     page size (default 20)
 *   offset?    page offset (default 0)
 *
 * Response:
 *   { accounts: SocialAccount[], count: number }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const { platform, status, limit, offset } = req.query as {
      platform?: string
      status?:   string
      limit?:    string
      offset?:   string
    }

    const filter: Record<string, unknown> = {}
    if (platform) filter.platform  = platform
    if (status)   filter.status    = status

    const take = parseInt(limit  ?? "20", 10)
    const skip = parseInt(offset ?? "0",  10)

    // MedusaService generates listAndCount<Entity> automatically; fall back to
    // listSocialAccounts if the generated method is unexpectedly absent.
    let accounts: any[]
    let count: number

    if (typeof (svc as any).listAndCountSocialAccounts === "function") {
      ;[accounts, count] = await (svc as any).listAndCountSocialAccounts(filter, { take, skip })
    } else {
      accounts = await svc.listSocialAccounts(filter, { take, skip })
      count    = accounts.length
    }

    res.json({ accounts, count })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Internal error" })
  }
}
