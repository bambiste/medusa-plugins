import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SOCIAL_COMMERCE_MODULE } from "../../../../modules/social-commerce/index"
import type { ISocialCommerceService } from '../../../../modules/social-commerce/services/social-commerce.service'
import { accountConnectedWorkflow } from '../../../../workflows/account-connected.workflow'

// ── HTML helpers ──────────────────────────────────────────────────────────────

function popupHtml(payload: Record<string, unknown>): string {
  const data = JSON.stringify(payload)
  const isSuccess = payload.type === 'tiktok-oauth-success'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>TikTok Connect</title></head><body>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage(${data}, '*');
    }
  } catch(e) {}
  window.close();
</script>
<p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#64748b">
  ${isSuccess ? 'Account connected! Closing…' : 'Connection failed. Closing…'}
</p>
</body></html>`
}

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * GET /social/oauth/callback
 *
 * Public TikTok OAuth redirect URI. Must be public (not under /admin or /store)
 * because TikTok redirects the browser here directly with no auth token.
 *
 * Set in your .env:
 *   TIKTOK_REDIRECT_URI=https://api-dev.leuzma.com/social/oauth/callback
 *
 * Set the same URL in your TikTok developer console → Login Kit → Redirect URIs.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sendPopup = (payload: Record<string, unknown>, status = 200) =>
    res.status(status).setHeader('Content-Type', 'text/html').send(popupHtml(payload))

  try {
    const { code, state, error, error_description } = req.query as {
      code?:              string
      state?:             string
      error?:             string
      error_description?: string
    }

    if (error) {
      return sendPopup({ type: 'tiktok-oauth-error', message: error_description ?? error, error }, 400)
    }

    if (!code || !state) {
      return sendPopup({ type: 'tiktok-oauth-error', message: 'Missing code or state parameter' }, 400)
    }

    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    // Validates HMAC signature + 10-min expiry, extracts codeVerifier for PKCE
    const statePayload = svc.tiktokApi.validateState(state)
    const { merchantId, codeVerifier } = statePayload

    const tokenSet = await svc.tiktokApi.exchangeCode(code, codeVerifier)
    const profile  = await svc.tiktokApi.getProfile(tokenSet.accessToken)

    const existing = await svc.listSocialAccounts({ external_id: profile.open_id, platform: 'tiktok' })

    const accountData = {
      merchant_id:             merchantId,
      platform:                'tiktok'  as const,
      external_id:             profile.open_id,
      username:                profile.display_name,
      display_name:            profile.display_name,
      avatar_url:              profile.avatar_url,
      encrypted_access_token:  svc.encryptToken(tokenSet.accessToken),
      encrypted_refresh_token: svc.encryptToken(tokenSet.refreshToken),
      token_scope:             tokenSet.scope,
      expires_at:              tokenSet.expiresAt,
      follower_count:          profile.follower_count,
      is_active:               true,
      status:                  'active' as const,
      metadata: {
        is_verified: profile.is_verified,
        union_id:    profile.union_id,
        open_id:     profile.open_id,
      },
    }

    let account: any
    if (existing.length) {
      ;[account] = await svc.updateSocialAccounts([{ id: existing[0].id, ...accountData }])
    } else {
      ;[account] = await svc.createSocialAccounts([accountData])
    }

    // Fire-and-forget — don't block popup close waiting for initial sync
    accountConnectedWorkflow(req.scope)
      .run({ input: { accountId: account.id } })
      .catch((err: Error) => console.error('[TikTok OAuth] accountConnectedWorkflow failed:', err?.message))

    return sendPopup({
      type:    'tiktok-oauth-success',
      account: {
        id:           account.id,
        platform:     account.platform,
        display_name: account.display_name ?? account.username,
        status:       account.status ?? 'active',
      },
    })
  } catch (err: any) {
    console.error('[TikTok OAuth] callback error:', err?.message)
    return sendPopup({ type: 'tiktok-oauth-error', message: err?.message ?? 'Internal error' }, 500)
  }
}
