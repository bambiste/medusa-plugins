import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { SOCIAL_COMMERCE_MODULE } from '../../../../modules/social-commerce/index'
import type { ISocialCommerceService } from '../../../../modules/social-commerce/services/social-commerce.service'

/**
 * GET /store/social/feed
 *
 * Query params:
 *   account_id?, filter by social account
 *   cursor?      pagination cursor (opaque string)
 *   limit?       page size, default 20, max 50
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const query      = req.query as Record<string, string | undefined>
    const account_id = query.account_id
    const cursor     = query.cursor
    const limit      = parseInt(query.limit ?? '20', 10)

    const result = await svc.getPublicFeed({ accountId: account_id, cursor, limit })

    res.json({
      videos:   result.data,
      cursor:   result.cursor,
      has_more: result.has_more,
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Internal error' })
  }
}
