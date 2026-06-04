import * as crypto from 'crypto'
import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { SOCIAL_COMMERCE_MODULE } from '../../../modules/social-commerce/index'
import type { ISocialCommerceService } from '../../../modules/social-commerce/services/social-commerce.service'
import { videoSyncedWorkflow }  from '../../../workflows/video-synced.workflow'
import { liveStartedWorkflow }  from '../../../workflows/live-started.workflow'
import { liveEndedWorkflow }    from '../../../workflows/live-ended.workflow'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeHmacSha256(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

function timingSafeEqual(a: string, b: string): boolean {
  // Ensure both strings have the same byte length before comparison to prevent
  // length-based timing leaks. Pad the shorter one with zeros.
  const aBuf = Buffer.from(a, 'hex')
  const bBuf = Buffer.from(b, 'hex')
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * POST /webhooks/tiktok
 *
 * Validates the TikTok webhook signature and dispatches the appropriate
 * workflow based on the event type. Always responds 200 quickly so TikTok
 * does not retry.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // ── 1. Validate signature ──────────────────────────────────────────────────

  const clientSecret = process.env.TIKTOK_CLIENT_SECRET ?? ''

  // Prefer a pre-parsed rawBody buffer set by upstream middleware; fall back to
  // re-serialising the parsed JSON body (best-effort — body-parser already
  // consumed the stream by the time this handler runs).
  const rawBody: string =
    typeof (req as any).rawBody === 'string'
      ? (req as any).rawBody
      : Buffer.isBuffer((req as any).rawBody)
      ? (req as any).rawBody.toString('utf8')
      : JSON.stringify(req.body)

  const signatureHeader = (req.headers['x-tiktok-signature'] as string | undefined) ?? ''
  // TikTok sends the header as "sha256=<hex>"
  const receivedHex = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader

  const expectedHex = computeHmacSha256(clientSecret, rawBody)

  if (!timingSafeEqual(expectedHex, receivedHex)) {
    return res.status(401).json({ message: 'Invalid webhook signature' })
  }

  // ── 2. Respond immediately (TikTok expects a fast 200) ────────────────────

  // Send the response before async processing so TikTok does not time out.
  res.status(200).json({ received: true })

  // ── 3. Handle event (fire-and-forget) ─────────────────────────────────────

  try {
    const body       = req.body as Record<string, any>
    const eventName  = body.event as string | undefined
    const eventData  = (body.data ?? {}) as Record<string, any>

    if (!eventName) return

    const svc = req.scope.resolve<ISocialCommerceService>(SOCIAL_COMMERCE_MODULE)

    if (eventName === 'user.video.publish') {
      // Look up the internal account by TikTok open_id
      const accounts = await svc.listSocialAccounts({
        external_id: eventData.open_id,
        platform:    'tiktok',
      })

      if (accounts.length) {
        const accountId = accounts[0].id
        // Fire-and-forget: sync the newly published video
        videoSyncedWorkflow(req.scope)
          .run({ input: { accountId, externalVideoId: eventData.item_id ?? eventData.video_id } })
          .catch((err: Error) => {
            console.error('[TikTok Webhook] videoSyncedWorkflow failed:', err?.message)
          })
      } else {
        console.warn('[TikTok Webhook] user.video.publish: no account found for open_id', eventData.open_id)
      }
    } else if (eventName === 'live.room.status_update') {
      const status = eventData.status as string | undefined

      const accounts = await svc.listSocialAccounts({
        external_id: eventData.open_id,
        platform:    'tiktok',
      })

      if (!accounts.length) {
        console.warn('[TikTok Webhook] live.room.status_update: no account found for open_id', eventData.open_id)
        return
      }

      const accountId         = accounts[0].id
      const externalSessionId = eventData.room_id as string

      if (status === 'live') {
        liveStartedWorkflow(req.scope)
          .run({ input: { accountId, externalSessionId } })
          .catch((err: Error) => {
            console.error('[TikTok Webhook] liveStartedWorkflow failed:', err?.message)
          })
      } else if (status === 'ended') {
        liveEndedWorkflow(req.scope)
          .run({ input: { accountId, externalSessionId } })
          .catch((err: Error) => {
            console.error('[TikTok Webhook] liveEndedWorkflow failed:', err?.message)
          })
      } else {
        console.warn('[TikTok Webhook] live.room.status_update: unhandled status', status)
      }
    } else {
      console.log('[TikTok Webhook] unhandled event:', eventName)
    }
  } catch (err: any) {
    // Log but do not re-throw — response already sent
    console.error('[TikTok Webhook] handler error:', err?.message)
  }
}
