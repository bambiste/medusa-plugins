import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SOCIAL_COMMERCE_MODULE } from '../../../../../../modules/social-commerce/index';
import type { ISocialCommerceService } from '../../../../../../modules/social-commerce/services/social-commerce.service';

interface ProductLink {
  medusa_product_id:  string
  medusa_variant_id?: string
  display_order?:     number
}

/**
 * POST /admin/social/videos/:id/products
 *
 * Replaces the product catalogue linked to a social video.
 * All existing social_products for the video are deleted and the new set is
 * created atomically (delete-then-insert).
 *
 * Body:
 *   {
 *     products: Array<{
 *       medusa_product_id:  string
 *       medusa_variant_id?: string
 *       display_order?:     number
 *     }>
 *   }
 *
 * Response:
 *   { social_products: SocialProduct[] }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const videoId = req.params.id
    const body    = (req.body ?? {}) as { products?: ProductLink[] }
    const products = body.products ?? []

    // ── Verify video exists ─────────────────────────────────────────────────
    const [video] = await (svc as any).listSocialVideos({ id: videoId })
    if (!video) {
      return res.status(404).json({ message: `Social video not found: ${videoId}` })
    }

    // ── Delete existing product links for this video ─────────────────────────
    const existing = await svc.listSocialProducts({ social_video_id: videoId })
    if (existing.length) {
      await svc.deleteSocialProducts(existing.map((p: any) => p.id))
    }

    // ── Create the new set of product links ─────────────────────────────────
    const social_products = products.length
      ? await svc.createSocialProducts(
          products.map((p, index) => ({
            social_video_id: videoId,
            product_id:      p.medusa_product_id,
            variant_id:      p.medusa_variant_id ?? null,
            display_order:   p.display_order     ?? index,
          })),
        )
      : []

    res.json({ social_products })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Internal error" })
  }
}
