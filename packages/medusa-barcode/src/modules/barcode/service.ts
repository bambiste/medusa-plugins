import { MedusaService } from "@medusajs/framework/utils"
import { BarcodeCache }   from "./models/barcode-cache"
import { BarcodeProduct } from "./models/barcode-product"
import { ProviderRegistry, runProviderFallbackChain } from "./providers/index"
import { parseBarcode }   from "./utils/barcode-parser"
import { sanitizeNormalized } from "./utils/normalize-product"
import {
  DEFAULT_CACHE_TTL_SECONDS,
} from "./constants"
import type {
  BarcodeModuleOptions,
  BarcodeProductRecord,
  CreateFromBarcodeResult,
  LookupResult,
  NormalizedProduct,
} from "./types"

// ─── Logger shim (Medusa injects `logger` into the container) ─────────────────

interface Logger {
  info(msg: string, ...args: unknown[]): void
  warn(msg: string, ...args: unknown[]): void
  error(msg: string, ...args: unknown[]): void
  debug(msg: string, ...args: unknown[]): void
}

const noopLogger: Logger = {
  info:  (...a) => console.info(...a),
  warn:  (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
  debug: (...a) => console.debug(...a),
}

// ─── Service ──────────────────────────────────────────────────────────────────

class BarcodeService extends MedusaService({ BarcodeCache, BarcodeProduct }) {
  protected readonly moduleOptions: BarcodeModuleOptions
  protected readonly providerRegistry: ProviderRegistry
  protected readonly logger: Logger

  constructor(
    container: Record<string, unknown>,
    options: Record<string, unknown> = {}
  ) {
    super(container)
    this.moduleOptions = options as BarcodeModuleOptions
    this.logger = (container.logger as Logger | undefined) ?? noopLogger
    this.providerRegistry = ProviderRegistry.fromOptions(this.moduleOptions.providerConfig ?? {})
  }

  // ─── Provider registry management ─────────────────────────────────────────

  /** Register a custom provider at runtime. */
  registerProvider(provider: InstanceType<typeof import("./providers/base.js").BaseBarcodeProvider>): void {
    this.providerRegistry.register(provider)
  }

  // ─── Lookup (cache → providers) ───────────────────────────────────────────

  /**
   * Main entry point for barcode lookups.
   *
   * Flow:
   *  1. Parse & validate the barcode string.
   *  2. Return from local cache if a non-expired entry exists (unless skipCache).
   *  3. Fan out to providers in priority order; stop on first hit.
   *  4. Cache the result with TTL and return it.
   */
  async lookupBarcode(
    raw: string,
    options: { skipCache?: boolean } = {}
  ): Promise<LookupResult> {
    const parsed = parseBarcode(raw)
    if (!parsed.isValid) {
      return { found: false, fromCache: false, error: parsed.error ?? "Invalid barcode" }
    }

    const barcode = parsed.normalized

    // 2. Cache check
    if (!options.skipCache) {
      const cached = await this.findValidCacheEntry(barcode)
      if (cached) {
        this.logger.info(`[barcode] Cache hit for ${barcode} (provider: ${cached.provider})`)
        return {
          found:     true,
          fromCache: true,
          provider:  cached.provider,
          product:   cached.normalized_data as unknown as NormalizedProduct,
          raw:       cached.raw_response as Record<string, unknown>,
        }
      }
    }

    // 3. Provider fallback chain
    const providerResult = await runProviderFallbackChain(
      this.providerRegistry,
      barcode,
      parsed.type,
      this.logger
    )

    if (!providerResult.found || !providerResult.product) {
      this.logger.info(`[barcode] No provider found data for ${barcode}`)
      return { found: false, fromCache: false, error: "Product not found in any provider" }
    }

    const normalized = sanitizeNormalized(providerResult.product)

    // 4. Cache the result
    await this.cacheResult(barcode, providerResult.provider, providerResult.raw ?? {}, normalized)

    return {
      found:     true,
      fromCache: false,
      provider:  providerResult.provider,
      product:   normalized,
      raw:       providerResult.raw,
    }
  }

  // ─── BarcodeProduct relations ──────────────────────────────────────────────

  /** Return the BarcodeProduct record for a barcode, or null. */
  async findBarcodeProduct(barcode: string): Promise<BarcodeProductRecord | null> {
    const parsed = parseBarcode(barcode)
    const results = await this.listBarcodeProducts({ barcode: parsed.normalized })
    return (results[0] as BarcodeProductRecord | undefined) ?? null
  }

  /** Idempotent: returns existing or creates a new BarcodeProduct row. */
  async saveBarcodeProduct(input: {
    barcode:         string
    product_id:      string
    variant_id?:     string
    source_provider?: string
    confidence_score?: number
  }): Promise<BarcodeProductRecord> {
    const parsed = parseBarcode(input.barcode)
    const existing = await this.findBarcodeProduct(parsed.normalized)

    if (existing) return existing

    const created = await this.createBarcodeProducts({
      barcode:          parsed.normalized,
      product_id:       input.product_id,
      variant_id:       input.variant_id ?? null,
      source_provider:  input.source_provider ?? null,
      confidence_score: input.confidence_score ?? null,
    })

    return created as unknown as BarcodeProductRecord
  }

  /** Remove the BarcodeProduct mapping for a barcode. */
  async removeBarcodeProduct(barcode: string): Promise<void> {
    const existing = await this.findBarcodeProduct(barcode)
    if (existing) {
      await this.deleteBarcodeProducts(existing.id)
    }
  }

  // ─── Cache management ──────────────────────────────────────────────────────

  /** Invalidate all cache entries for a barcode (forces fresh lookup). */
  async invalidateCache(barcode: string): Promise<void> {
    const parsed = parseBarcode(barcode)
    const entries = await this.listBarcodeCaches({ barcode: parsed.normalized })
    if (entries.length) {
      await this.deleteBarcodeCaches(entries.map((e: { id: string }) => e.id))
    }
  }

  /** Return cache statistics (total entries, expired entries). */
  async cacheStats(): Promise<{ total: number; expired: number }> {
    const all     = await this.listBarcodeCaches({})
    const now     = new Date()
    const expired = (all as Array<{ expires_at: Date | null }>).filter(
      e => e.expires_at && e.expires_at < now
    ).length
    return { total: all.length, expired }
  }

  /** Purge all expired cache entries. Returns the number of entries removed. */
  async purgeExpiredCache(): Promise<number> {
    const all     = await this.listBarcodeCaches({})
    const now     = new Date()
    const expired = (all as Array<{ id: string; expires_at: Date | null }>).filter(
      e => e.expires_at && e.expires_at < now
    )
    if (expired.length) {
      await this.deleteBarcodeCaches(expired.map(e => e.id))
    }
    return expired.length
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async findValidCacheEntry(barcode: string) {
    const entries = await this.listBarcodeCaches(
      { barcode },
      { order: { created_at: "DESC" }, take: 20 }
    )
    const now = new Date()
    const valid = (entries as Array<{ expires_at: Date | null } & typeof entries[0]>).find(
      e => !e.expires_at || e.expires_at > now
    )
    return valid ?? null
  }

  private async cacheResult(
    barcode:    string,
    provider:   string,
    raw:        Record<string, unknown>,
    normalized: NormalizedProduct
  ): Promise<void> {
    const ttlSec = this.moduleOptions.cache?.ttl ?? DEFAULT_CACHE_TTL_SECONDS
    const expires_at = new Date(Date.now() + ttlSec * 1_000)

    // Remove stale entries for this barcode+provider combination before inserting
    const stale = await this.listBarcodeCaches({ barcode, provider })
    if (stale.length) {
      await this.deleteBarcodeCaches(stale.map((e: { id: string }) => e.id))
    }

    await this.createBarcodeCaches({
      barcode,
      provider,
      raw_response:    raw,
      normalized_data: normalized as unknown as Record<string, unknown>,
      expires_at,
    })
  }
}

export type BarcodeServiceType = typeof BarcodeService
export type { BarcodeService }
export default BarcodeService
