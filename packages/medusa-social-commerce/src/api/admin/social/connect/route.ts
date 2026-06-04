import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SOCIAL_COMMERCE_MODULE } from '../../../../modules/social-commerce/index';
import type { ISocialCommerceService } from '../../../../modules/social-commerce/services/social-commerce.service';

/**
 * POST /admin/social/connect
 *
 * Generates a TikTok OAuth authorisation URL for a given merchant.
 *
 * Body:
 *   { merchant_id?: string }   — defaults to "default"
 *
 * Response:
 *   { url: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const body = (req.body ?? {}) as { merchant_id?: string }
    const merchantId = body.merchant_id ?? "default"

    const { url } = svc.tiktokApi.generateAuthUrl(merchantId)

    res.json({ url })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Internal error" })
  }
}
