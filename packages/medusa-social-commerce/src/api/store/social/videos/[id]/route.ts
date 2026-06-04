import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { SOCIAL_COMMERCE_MODULE } from '../../../../../modules/social-commerce/index'
import type { ISocialCommerceService } from '../../../../../modules/social-commerce/services/social-commerce.service'

/**
 * GET /store/social/videos/:id
 *
 * Returns a single active social video with its linked products.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const { id } = req.params

    const videos = await (svc as any).listSocialVideos({ id, status: 'active' })

    if (!videos.length) {
      return res.status(404).json({ message: `Video not found: ${id}` })
    }

    const socialProducts = await svc.listSocialProducts({ social_video_id: id })

    res.json({
      video:           videos[0],
      linked_products: socialProducts,
    })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? 'Internal error' })
  }
}
