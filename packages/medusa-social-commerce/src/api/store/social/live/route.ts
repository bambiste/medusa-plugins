import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { SOCIAL_COMMERCE_MODULE } from '../../../../modules/social-commerce/index'
import type { ISocialCommerceService } from '../../../../modules/social-commerce/services/social-commerce.service'

/**
 * GET /store/social/live
 *
 * Query params:
 *   account_id?, filter by social account
 *   limit?       page size, default 10
 *   offset?      pagination offset, default 0
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const query      = req.query as Record<string, string | undefined>
    const account_id = query.account_id
    const limit      = parseInt(query.limit  ?? '10', 10)
    const offset     = parseInt(query.offset ?? '0',  10)

    const filter: Record<string, unknown> = { status: 'live' }
    if (account_id) {
      filter.social_account_id = account_id
    }

    const sessions = await svc.listLiveSessions(filter, {
      take: limit,
      skip: offset,
    })

    res.json({ sessions })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Internal error' })
  }
}
