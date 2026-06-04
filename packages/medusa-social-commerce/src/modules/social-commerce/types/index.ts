// ─── OAuth ────────────────────────────────────────────────────────────────────

export interface TikTokOAuthConfig {
  clientKey: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

export interface OAuthStatePayload {
  timestamp:    number
  merchantId:   string
  nonce:        string
  codeVerifier: string
}

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  openId: string
  scope: string
}

// ─── TikTok API Responses ─────────────────────────────────────────────────────

export interface TikTokUserInfo {
  open_id: string
  union_id: string
  avatar_url: string
  display_name: string
  bio_description: string
  profile_deep_link: string
  is_verified: boolean
  follower_count: number
  following_count: number
  likes_count: number
  video_count: number
}

export interface TikTokVideo {
  id: string
  title: string
  create_time: number
  cover_image_url: string
  share_url: string
  video_description: string
  duration: number
  height: number
  width: number
  like_count: number
  comment_count: number
  share_count: number
  view_count: number
  embed_link?: string
}

export interface TikTokVideoListResponse {
  videos: TikTokVideo[]
  cursor: number
  has_more: boolean
}

export interface TikTokLiveSession {
  room_id: string
  title: string
  status: 'live' | 'ended'
  start_time: number
  end_time?: number
  user_count: number
  like_count: number
  total_user: number
}

// ─── Inventory Reservation ────────────────────────────────────────────────────

export type ReservationStatus = 'pending' | 'confirmed' | 'released' | 'expired'

export interface Reservation {
  id: string
  variantId: string
  quantity: number
  sessionId: string
  status: ReservationStatus
  expiresAt: number  // Unix timestamp ms
  createdAt: number
}

export interface ReserveResult {
  success: boolean
  reservationId?: string
  error?: 'INSUFFICIENT_STOCK' | 'LOCK_FAILED' | 'VARIANT_NOT_FOUND'
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncVideosResult {
  synced: number
  created: number
  updated: number
}

export interface VideoMetrics {
  like_count: number
  comment_count: number
  share_count: number
  view_count: number
}

export interface LiveMetrics {
  viewer_count: number
  like_count: number
  total_viewers: number
}

// ─── Cursor pagination ────────────────────────────────────────────────────────

export interface CursorPage<T> {
  data: T[]
  cursor: string | null
  has_more: boolean
}
