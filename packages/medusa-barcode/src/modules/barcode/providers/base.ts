import {
  DEFAULT_LOOKUP_TIMEOUT_MS,
  DEFAULT_LOOKUP_RETRIES,
  DEFAULT_PROVIDER_PRIORITY,
} from "../constants"
import type { BarcodeProviderConfig, NormalizedProduct } from "../types"

/** Delay helper for retry back-off */
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Abstract base for all barcode lookup providers.
 *
 * Concrete providers must implement:
 *   - `lookup(barcode)` — query the external API
 *   - `supports(barcodeType)` — return false to skip this provider for unsupported formats
 *
 * They get for free:
 *   - `fetchWithTimeout` — AbortController-wrapped fetch
 *   - `withRetry`        — exponential back-off retry loop
 *   - config merging     — enables/timeout/retries/priority
 */
export abstract class BaseBarcodeProvider {
  readonly providerId: string
  protected readonly config: BarcodeProviderConfig

  constructor(providerId: string, options: Partial<BarcodeProviderConfig> = {}) {
    this.providerId = providerId
    this.config = {
      enabled:  options.enabled  ?? true,
      timeout:  options.timeout  ?? DEFAULT_LOOKUP_TIMEOUT_MS,
      retries:  options.retries  ?? DEFAULT_LOOKUP_RETRIES,
      priority: options.priority ?? DEFAULT_PROVIDER_PRIORITY,
      apiKey:   options.apiKey,
    }
  }

  /** Whether this provider participates in lookups */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /** Lower = runs first in the fallback chain */
  getPriority(): number {
    return this.config.priority
  }

  /**
   * Perform the external barcode lookup.
   * Return `null` if the barcode is not found (not an error — just unknown).
   * Throw for network / authentication failures.
   */
  abstract lookup(barcode: string): Promise<NormalizedProduct | null>

  /**
   * Return true if this provider can handle the given barcode type.
   * Checked before calling `lookup` to short-circuit unsupported formats.
   */
  abstract supports(barcodeType: string): boolean

  // ─── Protected helpers ───────────────────────────────────────────────────

  /**
   * `fetch` wrapped with an AbortController timeout.
   * Throws `DOMException` (name: "AbortError") on timeout.
   */
  protected async fetchWithTimeout(
    url: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), this.config.timeout)
    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(tid)
    }
  }

  /**
   * Run `fn` up to `config.retries + 1` times with exponential back-off.
   * Rethrows the last error when all attempts are exhausted.
   */
  protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        if (attempt < this.config.retries) {
          await delay(500 * Math.pow(2, attempt)) // 500 ms, 1 s, 2 s …
        }
      }
    }
    throw lastError
  }
}
