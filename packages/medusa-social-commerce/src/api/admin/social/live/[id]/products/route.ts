import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SOCIAL_COMMERCE_MODULE } from '../../../../../../modules/social-commerce/index';
import type { ISocialCommerceService } from '../../../../../../modules/social-commerce/services/social-commerce.service';

interface ProductLink {
  medusa_product_id:  string
  medusa_variant_id?: string
  display_order?:     number
}

/**
 * POST /admin/social/live/:id/products
 *
 * Replaces the product catalogue linked to a live session.
 * All existing live_products for the session are deleted and the new set is
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
 *   { live_products: LiveProduct[] }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const sessionId = req.params.id
    const body      = (req.body ?? {}) as { products?: ProductLink[] }
    const products  = body.products ?? []

    // ── Verify live session exists ──────────────────────────────────────────
    const [liveSession] = await svc.listLiveSessions({ id: sessionId })
    if (!liveSession) {
      return res.status(404).json({ message: `Live session not found: ${sessionId}` })
    }

    // ── Delete existing product links for this session ───────────────────────
    const existing = await svc.listLiveProducts({ live_session_id: sessionId })
    if (existing.length) {
      await svc.deleteLiveProducts(existing.map((p: any) => p.id))
    }

    // ── Create the new set of product links ─────────────────────────────────
    const live_products = products.length
      ? await svc.createLiveProducts(
          products.map((p, index) => ({
            live_session_id: sessionId,
            variant_id:      p.medusa_variant_id ?? p.medusa_product_id,
            display_order:   p.display_order     ?? index,
          })),
        )
      : []

    res.json({ live_products })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Internal error" })
  }
}
