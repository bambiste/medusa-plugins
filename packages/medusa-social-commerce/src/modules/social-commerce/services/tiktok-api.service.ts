import * as crypto from 'crypto'
import type {
  TikTokOAuthConfig,
  OAuthStatePayload,
  TokenSet,
  TikTokUserInfo,
  TikTokVideoListResponse,
  TikTokVideo,
  VideoMetrics,
  TikTokLiveSession,
  LiveMetrics,
} from '../types/index'

const TIKTOK_AUTH_URL    = 'https://www.tiktok.com/v2/auth/authorize/'
const TIKTOK_TOKEN_URL   = 'https://open.tiktokapis.com/v2/oauth/token/'
const TIKTOK_REVOKE_URL  = 'https://open.tiktokapis.com/v2/oauth/revoke/'
const TIKTOK_API_BASE    = 'https://open.tiktokapis.com/v2'
const USER_INFO_FIELDS   = 'open_id,union_id,avatar_url,display_name,bio_description,is_verified,follower_count,following_count,likes_count,video_count'
const VIDEO_FIELDS       = 'id,title,create_time,cover_image_url,share_url,video_description,duration,height,width,like_count,comment_count,share_count,view_count,embed_link'

export interface TikTokApiOptions {
  clientKey:    string
  clientSecret: string
  redirectUri:  string
  scopes:       string[]
  stateSecret:  string  // HMAC key for state signing (32+ chars)
}

export class TikTokApiService {
  private readonly clientKey:    string
  private readonly clientSecret: string
  private readonly redirectUri:  string
  private readonly scopes:       string[]
  private readonly stateSecret:  string

  constructor(options: TikTokApiOptions) {
    if (!options.clientKey || !options.clientSecret || !options.redirectUri || !options.stateSecret) {
      throw new Error('TikTokApiService: missing required options (clientKey, clientSecret, redirectUri, stateSecret)')
    }
    this.clientKey    = options.clientKey
    this.clientSecret = options.clientSecret
    this.redirectUri  = options.redirectUri || process.env.TIKTOK_REDIRECT_URI || ''
    this.scopes       = options.scopes.length ? options.scopes : ['user.info.basic', 'video.list']
    this.stateSecret  = options.stateSecret
  }

  // ── OAuth ────────────────────────────────────────────────────────────────────

  generateAuthUrl(merchantId: string): { url: string; state: string } {
    // ── PKCE: generate verifier + S256 challenge ──────────────────────────────
    // TikTok OAuth v2 requires code_challenge (PKCE S256). The verifier is
    // embedded in the HMAC-signed state so the callback can retrieve it without
    // any server-side session storage.
    const codeVerifier  = crypto.randomBytes(32).toString('base64url')  // 43-char URL-safe string
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    const payload: OAuthStatePayload = {
      timestamp:    Date.now(),
      merchantId,
      nonce:        crypto.randomBytes(16).toString('hex'),
      codeVerifier,
    }
    const raw  = JSON.stringify(payload)
    const hmac = crypto.createHmac('sha256', this.stateSecret).update(raw).digest('hex')
    const state = Buffer.from(JSON.stringify({ raw, hmac })).toString('base64url')

    const params = new URLSearchParams({
      client_key:             this.clientKey,
      scope:                  this.scopes.join(','),
      response_type:          'code',
      redirect_uri:           this.redirectUri,
      state,
      code_challenge:         codeChallenge,
      code_challenge_method:  'S256',
    })
    return { url: `${TIKTOK_AUTH_URL}?${params.toString()}`, state }
  }

  validateState(state: string): OAuthStatePayload {
    let parsed: { raw: string; hmac: string }
    try {
      parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
    } catch {
      throw new Error('Invalid OAuth state: malformed encoding')
    }
    const expected = crypto.createHmac('sha256', this.stateSecret).update(parsed.raw).digest('hex')
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.hmac))) {
      throw new Error('Invalid OAuth state: HMAC mismatch (possible CSRF attack)')
    }
    const payload: OAuthStatePayload = JSON.parse(parsed.raw)
    const ageMs = Date.now() - payload.timestamp
    if (ageMs > 10 * 60 * 1000) {  // 10-minute state TTL
      throw new Error('OAuth state expired')
    }
    return payload
  }

  async exchangeCode(code: string, codeVerifier?: string): Promise<TokenSet> {
    const params: Record<string, string> = {
      client_key:    this.clientKey,
      client_secret: this.clientSecret,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  this.redirectUri,
    }
    if (codeVerifier) params.code_verifier = codeVerifier

    const body = new URLSearchParams(params)
    // Use postOAuth which handles TikTok's flat token-endpoint error format
    return this.postOAuth(TIKTOK_TOKEN_URL, body)
  }

  async refreshToken(currentRefreshToken: string): Promise<TokenSet> {
    const body = new URLSearchParams({
      client_key:    this.clientKey,
      client_secret: this.clientSecret,
      grant_type:    'refresh_token',
      refresh_token: currentRefreshToken,
    })
    return this.postOAuth(TIKTOK_TOKEN_URL, body)
  }

  async revokeToken(accessToken: string): Promise<void> {
    const body = new URLSearchParams({
      client_key:   this.clientKey,
      access_token: accessToken,
    })
    await this.postForm(TIKTOK_REVOKE_URL, body)
  }

  // ── Account ──────────────────────────────────────────────────────────────────

  async getProfile(accessToken: string): Promise<TikTokUserInfo> {
    const data = await this.get<{ data: { user: TikTokUserInfo } }>(
      `${TIKTOK_API_BASE}/user/info/?fields=${USER_INFO_FIELDS}`,
      accessToken,
    )
    return data.data.user
  }

  async getPermissions(accessToken: string): Promise<string[]> {
    const data = await this.get<{ data: { permissions: string[] } }>(
      `${TIKTOK_API_BASE}/oauth/token/info/`,
      accessToken,
    )
    return data.data.permissions ?? []
  }

  // ── Videos ───────────────────────────────────────────────────────────────────

  async listVideos(
    accessToken: string,
    cursor?: number,
    maxCount = 20,
  ): Promise<TikTokVideoListResponse> {
    const body: Record<string, unknown> = { max_count: maxCount }
    if (cursor !== undefined) body.cursor = cursor
    const data = await this.post<{
      data: {
        videos: TikTokVideo[]
        cursor: number
        has_more: boolean
      }
    }>(
      `${TIKTOK_API_BASE}/video/list/?fields=${VIDEO_FIELDS}`,
      body,
      accessToken,
    )
    return {
      videos:   data.data.videos ?? [],
      cursor:   data.data.cursor,
      has_more: data.data.has_more,
    }
  }

  async getVideo(accessToken: string, videoId: string): Promise<TikTokVideo> {
    const data = await this.post<{ data: { videos: TikTokVideo[] } }>(
      `${TIKTOK_API_BASE}/video/query/?fields=${VIDEO_FIELDS}`,
      { filters: { video_ids: [videoId] } },
      accessToken,
    )
    const video = (data.data.videos ?? [])[0]
    if (!video) throw new Error(`Video not found: ${videoId}`)
    return video
  }

  async getVideoMetrics(accessToken: string, videoId: string): Promise<VideoMetrics> {
    const video = await this.getVideo(accessToken, videoId)
    return {
      like_count:    video.like_count,
      comment_count: video.comment_count,
      share_count:   video.share_count,
      view_count:    video.view_count,
    }
  }

  // ── Live sessions ─────────────────────────────────────────────────────────────

  async listLiveSessions(accessToken: string, cursor?: string): Promise<{
    sessions: TikTokLiveSession[]
    cursor:   string | null
    has_more: boolean
  }> {
    const body: Record<string, unknown> = { fields: 'room_id,title,status,start_time,end_time,user_count,like_count,total_user' }
    if (cursor) body.cursor = cursor
    const data = await this.post<{
      data: {
        live_list:   TikTokLiveSession[]
        next_cursor: string
        has_more:    boolean
      }
    }>(`${TIKTOK_API_BASE}/live/search/`, body, accessToken)
    return {
      sessions: data.data.live_list ?? [],
      cursor:   data.data.next_cursor ?? null,
      has_more: data.data.has_more ?? false,
    }
  }

  async getLiveSession(accessToken: string, roomId: string): Promise<TikTokLiveSession> {
    const data = await this.post<{ data: { live: TikTokLiveSession } }>(
      `${TIKTOK_API_BASE}/live/info/`,
      { room_id: roomId },
      accessToken,
    )
    return data.data.live
  }

  async getLiveMetrics(accessToken: string, roomId: string): Promise<LiveMetrics> {
    const session = await this.getLiveSession(accessToken, roomId)
    return {
      viewer_count:  session.user_count,
      like_count:    session.like_count,
      total_viewers: session.total_user,
    }
  }

  // ── Webhook signature validation ──────────────────────────────────────────────

  validateWebhookSignature(rawBody: string | Buffer, signature: string, webhookSecret: string): void {
    const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex')
    const sigHex = signature.startsWith('sha256=') ? signature.slice(7) : signature
    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sigHex, 'hex'))) {
      throw new Error('Webhook signature validation failed')
    }
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────────

  private async get<T>(url: string, accessToken: string): Promise<T> {
    return this.request<T>(url, {
      method:  'GET',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
  }

  private async post<T>(url: string, body: unknown, accessToken: string): Promise<T> {
    return this.request<T>(url, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  private async postForm<T>(url: string, body: URLSearchParams): Promise<T> {
    return this.request<T>(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    })
  }

  // Handles TikTok OAuth token endpoint specifically.
  // That endpoint uses a FLAT error format {error: string, error_description: string}
  // unlike the REST API which uses {error: {code: number, message: string}}.
  private async postOAuth(url: string, body: URLSearchParams): Promise<TokenSet> {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    })

    const raw = await res.text()
    console.log(`[TikTok OAuth] token exchange status=${res.status} body=${raw}`)

    let json: Record<string, any>
    try {
      json = JSON.parse(raw)
    } catch {
      throw new Error(`TikTok OAuth: non-JSON response (${res.status}): ${raw}`)
    }

    // Flat error format used by the token endpoint
    if (json.error && typeof json.error === 'string') {
      throw new Error(`TikTok OAuth error [${json.error}]: ${json.error_description ?? ''}`)
    }

    // Nested error format (some versions)
    if (json.error?.code && json.error.code !== 0) {
      throw new Error(`TikTok OAuth error [${json.error.code}]: ${json.error.message ?? json.error_description ?? ''}`)
    }

    if (!res.ok) {
      throw new Error(`TikTok OAuth token exchange failed (${res.status}): ${raw}`)
    }

    if (!json.access_token) {
      throw new Error(`TikTok OAuth: no access_token in response. Body: ${raw}`)
    }

    return {
      accessToken:  json.access_token,
      refreshToken: json.refresh_token,
      expiresAt:    new Date(Date.now() + json.expires_in * 1000),
      openId:       json.open_id,
      scope:        json.scope,
    }
  }

  private async request<T>(url: string, init: RequestInit, attempt = 0): Promise<T> {
    const MAX_ATTEMPTS = 3
    const res = await fetch(url, init)

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '0', 10)
      const delay = retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * Math.pow(2, attempt), 32000)
      if (attempt < MAX_ATTEMPTS) {
        await this.sleep(delay)
        return this.request<T>(url, init, attempt + 1)
      }
      throw new Error('TikTok API rate limit exceeded after retries')
    }

    if (res.status === 401) {
      throw Object.assign(new Error('TikTok access token invalid or expired'), { code: 'TOKEN_EXPIRED' })
    }

    if (!res.ok) {
      const text = await res.text()
      console.error(`[TikTok API] ${init.method ?? 'GET'} ${url} → ${res.status}: ${text}`)
      const err = new Error(`TikTok API error ${res.status}: ${text}`)
      if (attempt < MAX_ATTEMPTS && res.status >= 500) {
        await this.sleep(Math.min(500 * Math.pow(2, attempt), 8000) + Math.random() * 200)
        return this.request<T>(url, init, attempt + 1)
      }
      throw err
    }

    const json = await res.json() as any
    // TikTok REST API error format: {error: {code: "ok"|"some_error", message: string}, data: {}}
    // Success is indicated by code === "ok" or code === 0 (not by HTTP status alone)
    const errCode = json?.error?.code
    if (errCode && errCode !== 'ok' && errCode !== 0) {
      const msg = json.error.message || json.error.error_description || String(errCode)
      throw new Error(`TikTok API error [${errCode}]: ${msg}`)
    }
    return json as T
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
