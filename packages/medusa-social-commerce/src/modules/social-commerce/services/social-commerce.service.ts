import * as crypto from 'crypto'
import { MedusaService } from '@medusajs/framework/utils'
import { SocialAccount }   from '../models/social-account'
import { SocialVideo }     from '../models/social-video'
import { LiveSession }     from '../models/live-session'
import { SocialProduct }   from '../models/social-product'
import { LiveProduct }     from '../models/live-product'
import { TikTokApiService }            from './tiktok-api.service'
import { InventoryReservationService } from './inventory-reservation.service'
import type {
  TokenSet,
  TikTokUserInfo,
  TikTokVideoListResponse,
  SyncVideosResult,
  ReserveResult,
  Reservation,
  CursorPage,
} from '../types/index'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

class SocialCommerceService extends MedusaService({
  SocialAccount,
  SocialVideo,
  LiveSession,
  SocialProduct,
  LiveProduct,
}) {
  private readonly tiktok:       TikTokApiService
  private readonly reservations: InventoryReservationService
  private readonly encKey:       Buffer

  constructor(container: Record<string, any>, options: Record<string, any>) {
    super(...arguments)

    const encKeyHex = options.encryption_key ?? process.env.SC_ENCRYPTION_KEY
    if (!encKeyHex || encKeyHex.length < 64) {
      throw new Error('SocialCommerceService: SC_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
    }
    this.encKey = Buffer.from(encKeyHex, 'hex')

    this.tiktok = new TikTokApiService({
      clientKey:    options.tiktok_client_key    ?? process.env.TIKTOK_CLIENT_KEY!,
      clientSecret: options.tiktok_client_secret ?? process.env.TIKTOK_CLIENT_SECRET!,
      redirectUri:  options.tiktok_redirect_uri  ?? process.env.TIKTOK_REDIRECT_URI!,
      scopes:       (options.tiktok_scopes ?? process.env.TIKTOK_SCOPES ?? 'user.info.basic,video.list').split(','),
      stateSecret:  options.tiktok_state_secret  ?? process.env.TIKTOK_STATE_SECRET!,
    })

    const redisUrl = options.redis_url ?? process.env.REDIS_URL ?? 'redis://localhost:6379'
    this.reservations = new InventoryReservationService({
      redisUrl,
      defaultTtlSeconds: parseInt(String(options.reservation_ttl_seconds ?? '300'), 10),
      lockTtlSeconds:    5,
    })
  }

  // ── Token Encryption ──────────────────────────────────────────────────────────

  encryptToken(plaintext: string): string {
    const iv      = crypto.randomBytes(IV_LENGTH)
    const cipher  = crypto.createCipheriv(ALGORITHM, this.encKey, iv)
    const enc     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag     = cipher.getAuthTag()
    return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
  }

  decryptToken(ciphertext: string): string {
    const parts = ciphertext.split(':')
    if (parts.length !== 3) throw new Error('Invalid encrypted token format')
    const [ivHex, tagHex, encHex] = parts
    const iv      = Buffer.from(ivHex,  'hex')
    const tag     = Buffer.from(tagHex, 'hex')
    const enc     = Buffer.from(encHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, this.encKey, iv)
    decipher.setAuthTag(tag)
    return decipher.update(enc).toString('utf8') + decipher.final('utf8')
  }

  // ── OAuth Flow ────────────────────────────────────────────────────────────────

  generateTikTokAuthUrl(merchantId: string): { url: string; state: string } {
    return this.tiktok.generateAuthUrl(merchantId)
  }

  validateTikTokState(state: string): { merchantId: string } {
    const payload = this.tiktok.validateState(state)
    return { merchantId: payload.merchantId }
  }

  async exchangeTikTokCode(code: string, merchantId: string): Promise<{
    account: any
    profile: TikTokUserInfo
  }> {
    const tokens  = await this.tiktok.exchangeCode(code)
    const profile = await this.tiktok.getProfile(tokens.accessToken)

    // Upsert the social account
    const existing = await this.listSocialAccounts({
      platform:    'tiktok',
      external_id: tokens.openId,
    })

    const accountData = {
      merchant_id:             merchantId,
      platform:                'tiktok' as const,
      external_id:             tokens.openId,
      username:                profile.display_name,
      avatar_url:              profile.avatar_url,
      encrypted_access_token:  this.encryptToken(tokens.accessToken),
      encrypted_refresh_token: this.encryptToken(tokens.refreshToken),
      token_scope:             tokens.scope,
      expires_at:              tokens.expiresAt,
      follower_count:          profile.follower_count,
      is_active:               true,
      metadata:                { open_id: tokens.openId },
    }

    let account: any
    if (existing.length) {
      ;[account] = await this.updateSocialAccounts([{ id: existing[0].id, ...accountData }])
    } else {
      ;[account] = await this.createSocialAccounts([accountData])
    }

    return { account, profile }
  }

  async revokeTikTokAccount(accountId: string): Promise<void> {
    const [account] = await this.listSocialAccounts({ id: accountId })
    if (!account) throw new Error(`Social account not found: ${accountId}`)
    const accessToken = this.decryptToken(account.encrypted_access_token)
    try {
      await this.tiktok.revokeToken(accessToken)
    } catch {
      // Best-effort revocation — still mark inactive locally
    }
    await this.updateSocialAccounts([{ id: accountId, is_active: false }])
  }

  // ── Token lifecycle ───────────────────────────────────────────────────────────

  async getValidAccessToken(accountId: string): Promise<string> {
    const [account] = await this.listSocialAccounts({ id: accountId })
    if (!account) throw new Error(`Social account not found: ${accountId}`)

    const bufferMs   = 5 * 60 * 1000  // Refresh 5 minutes before expiry
    const expiresAt  = new Date(account.expires_at)
    const needsRefresh = expiresAt.getTime() - Date.now() < bufferMs

    if (!needsRefresh) {
      return this.decryptToken(account.encrypted_access_token)
    }

    const refreshToken = this.decryptToken(account.encrypted_refresh_token)
    const tokens       = await this.tiktok.refreshToken(refreshToken)

    await this.updateSocialAccounts([{
      id:                      accountId,
      encrypted_access_token:  this.encryptToken(tokens.accessToken),
      encrypted_refresh_token: this.encryptToken(tokens.refreshToken),
      expires_at:              tokens.expiresAt,
    }])

    return tokens.accessToken
  }

  // ── Video Sync ────────────────────────────────────────────────────────────────

  async syncVideos(accountId: string): Promise<SyncVideosResult> {
    const accessToken  = await this.getValidAccessToken(accountId)
    let cursor: number | undefined
    let has_more       = true
    let created        = 0
    let updated        = 0

    while (has_more) {
      const page = await this.tiktok.listVideos(accessToken, cursor)
      for (const vid of page.videos) {
        const existing = await (this as any).listSocialVideos({
          social_account_id: accountId,
          external_id:       vid.id,
        })
        const videoData = {
          social_account_id: accountId,
          external_id:       vid.id,
          caption:           vid.video_description ?? vid.title ?? null,
          thumbnail_url:     vid.cover_image_url ?? null,
          video_url:         vid.share_url ?? null,
          embed_link:        vid.embed_link ?? null,
          duration_seconds:  vid.duration ?? 0,
          metrics: {
            like_count:    vid.like_count,
            comment_count: vid.comment_count,
            share_count:   vid.share_count,
            view_count:    vid.view_count,
          },
          status:       'active' as const,
          published_at: vid.create_time ? new Date(vid.create_time * 1000) : null,
        }

        if (existing.length) {
          await (this as any).updateSocialVideos([{ id: existing[0].id, ...videoData }])
          updated++
        } else {
          await (this as any).createSocialVideos([videoData])
          created++
        }
      }
      cursor   = page.cursor
      has_more = page.has_more
      // Safety: avoid infinite loops if cursor doesn't advance
      if (!cursor) break
    }

    return { synced: created + updated, created, updated }
  }

  // ── Live Session Sync ─────────────────────────────────────────────────────────

  async upsertLiveSession(accountId: string, externalSession: {
    external_id:  string
    title?:       string | null
    status:       'live' | 'ended' | 'scheduled'
    started_at?:  Date | null
    ended_at?:    Date | null
    viewer_count: number
    metrics?:     Record<string, unknown>
  }): Promise<any> {
    const existing = await this.listLiveSessions({
      social_account_id: accountId,
      external_id:       externalSession.external_id,
    })

    const data = {
      social_account_id: accountId,
      external_id:       externalSession.external_id,
      title:             externalSession.title ?? null,
      status:            externalSession.status,
      started_at:        externalSession.started_at ?? null,
      ended_at:          externalSession.ended_at ?? null,
      viewer_count:      externalSession.viewer_count,
      metrics:           externalSession.metrics ?? null,
    }

    if (existing.length) {
      const [session] = await this.updateLiveSessions([{ id: existing[0].id, ...data }])
      return session
    }
    const [session] = await this.createLiveSessions([data])
    return session
  }

  // ── Inventory Reservation (delegates to Redis service) ────────────────────────

  reserveStock(
    variantId:   string,
    quantity:    number,
    sessionId:   string,
    maxStock:    number,
    ttlSeconds?: number,
  ): Promise<ReserveResult> {
    return this.reservations.reserve(variantId, quantity, sessionId, maxStock, ttlSeconds)
  }

  releaseStock(reservationId: string): Promise<boolean> {
    return this.reservations.release(reservationId)
  }

  confirmStock(reservationId: string): Promise<boolean> {
    return this.reservations.confirm(reservationId)
  }

  getReservation(reservationId: string): Promise<Reservation | null> {
    return this.reservations.getReservation(reservationId)
  }

  getAvailableStock(variantId: string, maxStock: number): Promise<number> {
    return this.reservations.getAvailableStock(variantId, maxStock)
  }

  expireSessionReservations(sessionId: string): Promise<number> {
    return this.reservations.expireSessionReservations(sessionId)
  }

  // ── Storefront feed (public) ──────────────────────────────────────────────────

  async getPublicFeed(params: {
    accountId?: string
    cursor?:    string
    limit?:     number
  }): Promise<CursorPage<any>> {
    const limit  = Math.min(params.limit ?? 20, 50)
    const offset = params.cursor ? parseInt(params.cursor, 10) : 0

    const filter: Record<string, unknown> = { status: 'active' }
    if (params.accountId) filter.social_account_id = params.accountId

    const videos = await (this as any).listSocialVideos(filter, {
      take:      limit + 1,
      skip:      offset,
      order:     { published_at: 'DESC' },
    })

    const has_more = videos.length > limit
    const data     = has_more ? videos.slice(0, limit) : videos
    const nextCursor = has_more ? String(offset + limit) : null

    return { data, cursor: nextCursor, has_more }
  }

  // ── Direct TikTok API access (for admin ops) ──────────────────────────────────

  get tiktokApi(): TikTokApiService {
    return this.tiktok
  }
}

export type ISocialCommerceService = InstanceType<typeof SocialCommerceService>
export default SocialCommerceService
