import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SOCIAL_COMMERCE_MODULE } from '../../../../modules/social-commerce/index';
import type { ISocialCommerceService } from '../../../../modules/social-commerce/services/social-commerce.service';

/**
 * POST /admin/social/sync
 *
 * Triggers a full video sync for a connected social account. Fetches all
 * videos from TikTok and upserts them into the local database.
 *
 * Body:
 *   { account_id: string }
 *
 * Response:
 *   { result: SyncVideosResult }   — { synced, created, updated }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const body = (req.body ?? {}) as { account_id?: string }

    if (!body.account_id) {
      return res.status(400).json({ message: "Missing required body field: account_id" })
    }

    const result = await svc.syncVideos(body.account_id)

    res.json({ result })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Internal error" })
  }
}
