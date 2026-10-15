import * as crypto from 'crypto'
import Redis from 'ioredis'
import type { Reservation, ReservationStatus, ReserveResult } from '../types/index'

// Lua: Atomically acquire lock, check available stock, increment reservation counter, persist reservation.
// Returns [1, 'OK'] on success or [0, error_reason] on failure.
const RESERVE_SCRIPT = `
local lock_key     = KEYS[1]
local reserved_key = KEYS[2]
local res_key      = KEYS[3]
local lock_val     = ARGV[1]
local lock_ttl     = tonumber(ARGV[2])
local quantity     = tonumber(ARGV[3])
local max_stock    = tonumber(ARGV[4])
local res_json     = ARGV[5]
local res_ttl      = tonumber(ARGV[6])

local locked = redis.call('SET', lock_key, lock_val, 'NX', 'EX', lock_ttl)
if not locked then
  return {0, 'LOCK_FAILED'}
end

local reserved = tonumber(redis.call('GET', reserved_key) or '0')
if reserved + quantity > max_stock then
  redis.call('DEL', lock_key)
  return {0, 'INSUFFICIENT_STOCK'}
end

redis.call('INCRBY', reserved_key, quantity)
redis.call('SET', res_key, res_json, 'EX', res_ttl)
redis.call('DEL', lock_key)
return {1, 'OK'}
`

// Lua: Release reservation, decrement counter, delete reservation record.
const RELEASE_SCRIPT = `
local reserved_key = KEYS[1]
local res_key      = KEYS[2]
local quantity     = tonumber(ARGV[1])

local existing = redis.call('GET', res_key)
if not existing then
  return {0, 'NOT_FOUND'}
end

local current = tonumber(redis.call('GET', reserved_key) or '0')
local next_val = math.max(0, current - quantity)
redis.call('SET', reserved_key, next_val)
redis.call('DEL', res_key)
return {1, 'OK'}
`

// Lua: Confirm reservation (mark sold, decrement reserved, do NOT release stock, stock reduction is handled by Medusa inventory).
const CONFIRM_SCRIPT = `
local reserved_key = KEYS[1]
local res_key      = KEYS[2]
local quantity     = tonumber(ARGV[1])

local existing = redis.call('GET', res_key)
if not existing then
  return {0, 'NOT_FOUND'}
end

local res = cjson.decode(existing)
if res['status'] ~= 'pending' then
  return {0, 'INVALID_STATUS'}
end

local current = tonumber(redis.call('GET', reserved_key) or '0')
redis.call('SET', reserved_key, math.max(0, current - quantity))
res['status'] = 'confirmed'
redis.call('SET', res_key, cjson.encode(res), 'EX', 86400)
return {1, 'OK'}
`

export interface InventoryReservationOptions {
  redisUrl:          string
  defaultTtlSeconds: number  // How long a reservation lives before auto-expiry
  lockTtlSeconds:    number  // How long the distributed lock is held
}

export class InventoryReservationService {
  private readonly redis:              Redis
  private readonly defaultTtlSeconds:  number
  private readonly lockTtlSeconds:     number

  constructor(options: InventoryReservationOptions) {
    this.redis             = new Redis(options.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 })
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 300  // 5-minute default
    this.lockTtlSeconds    = options.lockTtlSeconds    ?? 5
  }

  // Reserve quantity for a variant. Returns the reservation ID on success.
  async reserve(
    variantId:   string,
    quantity:    number,
    sessionId:   string,
    maxStock:    number,
    ttlSeconds?: number,
  ): Promise<ReserveResult> {
    if (quantity <= 0) return { success: false, error: 'INSUFFICIENT_STOCK' }

    const reservationId = crypto.randomUUID()
    const ttl           = ttlSeconds ?? this.defaultTtlSeconds
    const now           = Date.now()

    const reservation: Reservation = {
      id:        reservationId,
      variantId,
      quantity,
      sessionId,
      status:    'pending',
      expiresAt: now + ttl * 1000,
      createdAt: now,
    }

    const keys = [
      this.lockKey(variantId),
      this.reservedKey(variantId),
      this.reservationKey(reservationId),
    ]
    const args = [
      crypto.randomBytes(16).toString('hex'),  // lock value (unique per attempt)
      String(this.lockTtlSeconds),
      String(quantity),
      String(maxStock),
      JSON.stringify(reservation),
      String(ttl),
    ]

    const result = await (this.redis as any).eval(RESERVE_SCRIPT, 3, ...keys, ...args) as [number, string]
    if (result[0] === 1) {
      return { success: true, reservationId }
    }
    const error = result[1] as ReserveResult['error']
    return { success: false, error: error === 'LOCK_FAILED' ? 'LOCK_FAILED' : 'INSUFFICIENT_STOCK' }
  }

  // Release a pending reservation (e.g., user abandoned cart / session ended).
  async release(reservationId: string): Promise<boolean> {
    const resData = await this.redis.get(this.reservationKey(reservationId))
    if (!resData) return false

    const reservation: Reservation = JSON.parse(resData)
    if (reservation.status !== 'pending') return false

    const keys = [
      this.reservedKey(reservation.variantId),
      this.reservationKey(reservationId),
    ]
    const result = await (this.redis as any).eval(RELEASE_SCRIPT, 2, ...keys, String(reservation.quantity)) as [number, string]
    return result[0] === 1
  }

  // Confirm a reservation after order placement. Decrements Redis counter; Medusa handles actual inventory deduction.
  async confirm(reservationId: string): Promise<boolean> {
    const resData = await this.redis.get(this.reservationKey(reservationId))
    if (!resData) return false

    const reservation: Reservation = JSON.parse(resData)
    const keys = [
      this.reservedKey(reservation.variantId),
      this.reservationKey(reservationId),
    ]
    const result = await (this.redis as any).eval(CONFIRM_SCRIPT, 2, ...keys, String(reservation.quantity)) as [number, string]
    return result[0] === 1
  }

  // Get total reserved quantity for a variant (for stock availability calculation).
  async getReservedQuantity(variantId: string): Promise<number> {
    const val = await this.redis.get(this.reservedKey(variantId))
    return val ? parseInt(val, 10) : 0
  }

  // Get reservation details.
  async getReservation(reservationId: string): Promise<Reservation | null> {
    const data = await this.redis.get(this.reservationKey(reservationId))
    return data ? (JSON.parse(data) as Reservation) : null
  }

  // Expire all reservations for a live session (called when session ends).
  // Scans Redis for pending reservations belonging to a sessionId.
  // NOTE: In production, maintain a session→reservation index for O(1) lookup.
  async expireSessionReservations(sessionId: string): Promise<number> {
    let released = 0
    let cursor   = '0'
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'reservation:*', 'COUNT', 100)
      cursor = nextCursor
      if (!keys.length) continue
      const values = await this.redis.mget(...keys)
      for (let i = 0; i < keys.length; i++) {
        const raw = values[i]
        if (!raw) continue
        const res: Reservation = JSON.parse(raw)
        if (res.sessionId === sessionId && res.status === 'pending') {
          const ok = await this.release(res.id)
          if (ok) released++
        }
      }
    } while (cursor !== '0')
    return released
  }

  // Get available stock for a variant (maxStock - reserved).
  async getAvailableStock(variantId: string, maxStock: number): Promise<number> {
    const reserved = await this.getReservedQuantity(variantId)
    return Math.max(0, maxStock - reserved)
  }

  async disconnect(): Promise<void> {
    await this.redis.quit()
  }

  private lockKey(variantId: string):        string { return `lock:variant:${variantId}` }
  private reservedKey(variantId: string):    string { return `reserved:variant:${variantId}` }
  private reservationKey(id: string):        string { return `reservation:${id}` }
}
