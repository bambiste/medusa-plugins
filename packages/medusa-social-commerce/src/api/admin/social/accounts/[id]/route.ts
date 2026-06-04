import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SOCIAL_COMMERCE_MODULE } from "../../../../../modules/social-commerce/index"
import type { ISocialCommerceService } from "../../../../../modules/social-commerce/services/social-commerce.service"

/**
 * GET /admin/social/accounts/:id
 *
 * Retrieves a single social account by its database id.
 *
 * Response:
 *   { account: SocialAccount }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const { id } = req.params

    const [account] = await svc.listSocialAccounts({ id })

    if (!account) {
      return res.status(404).json({ message: `Social account not found: ${id}` })
    }

    res.json({ account })
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Internal error" })
  }
}

/**
 * DELETE /admin/social/accounts/:id
 *
 * Disconnects a social account. Attempts a best-effort token revocation with
 * TikTok before deleting the local record; revocation failures are silently
 * ignored so the local record is always cleaned up.
 *
 * Response:
 *   204 No Content
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  try {
    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    const { id } = req.params

    const [account] = await svc.listSocialAccounts({ id })

    if (!account) {
      return res.status(404).json({ message: `Social account not found: ${id}` })
    }

    // Best-effort token revocation — fire and forget, never fail the request
    try {
      const accessToken = svc.decryptToken(account.encrypted_access_token)
      await svc.tiktokApi.revokeToken(accessToken)
    } catch {
      // Intentionally swallowed — revocation is non-critical
    }

    await svc.deleteSocialAccounts([id])

    res.status(204).send()
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Internal error" })
  }
}
