import { BARCODE_TYPES, PROVIDER_IDS } from "../constants"
import type { NormalizedProduct, UpcItemDbProviderOptions } from "../types"
import { BaseBarcodeProvider } from "./base"

// ─── Raw API shape ────────────────────────────────────────────────────────────

interface UpcItemDbItem {
  ean?:          string
  title?:        string
  description?:  string
  brand?:        string
  model?:        string
  color?:        string
  size?:         string
  dimension?:    string
  weight?:       string
  category?:     string
  images?:       string[]
  lowest_recorded_price?: number
  highest_recorded_price?: number
  [key: string]: unknown
}

interface UpcItemDbResponse {
  code:   string           // "OK" | "INVALID_UPC" | "NOT_FOUND" ...
  total:  number
  items?: UpcItemDbItem[]
  message?: string
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class UpcItemDbProvider extends BaseBarcodeProvider {
  private readonly apiKey: string | undefined

  /**
   * Trial tier: https://api.upcitemdb.com/prod/trial/lookup
   * Paid tier: https://api.upcitemdb.com/prod/v1/lookup  (requires apiKey)
   */
  private get baseUrl(): string {
    return this.apiKey
      ? "https://api.upcitemdb.com/prod/v1"
      : "https://api.upcitemdb.com/prod/trial"
  }

  constructor(options: UpcItemDbProviderOptions = {}) {
    super(PROVIDER_IDS.UPC_ITEM_DB, {
      enabled:  options.enabled  ?? true,
      timeout:  options.timeout  ?? 10_000,
      retries:  options.retries  ?? 2,
      priority: options.priority ?? 80,
      apiKey:   options.apiKey,
    })
    this.apiKey = options.apiKey
  }

  /** UpcItemDb covers all common 1D symbologies */
  supports(barcodeType: string): boolean {
    return (
      barcodeType === BARCODE_TYPES.EAN13   ||
      barcodeType === BARCODE_TYPES.UPC_A   ||
      barcodeType === BARCODE_TYPES.UPC_E   ||
      barcodeType === BARCODE_TYPES.CODE128
    )
  }

  async lookup(barcode: string): Promise<NormalizedProduct | null> {
    const url = `${this.baseUrl}/lookup?upc=${encodeURIComponent(barcode)}`

    const headers: Record<string, string> = {
      "Accept":     "application/json",
      "User-Agent": "medusa-barcode-plugin/1.0",
    }
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`
    }

    return this.withRetry(async () => {
      const res = await this.fetchWithTimeout(url, { headers })

      // 429 = rate-limited on trial tier, surface as retriable error
      if (res.status === 429) {
        throw new Error("UpcItemDb rate limit exceeded")
      }
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error(`UpcItemDb HTTP ${res.status}`)
      }

      const body = (await res.json()) as UpcItemDbResponse

      if (body.code !== "OK" || !body.items?.length) {
        return null
      }

      return this.normalise(barcode, body.items[0])
    })
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private normalise(barcode: string, item: UpcItemDbItem): NormalizedProduct {
    const metadata: Record<string, unknown> = {}
    if (item.model)  metadata.model  = item.model
    if (item.color)  metadata.color  = item.color
    if (item.size)   metadata.size   = item.size
    if (item.dimension) metadata.dimension = item.dimension
    if (item.lowest_recorded_price != null)  metadata.lowest_price  = item.lowest_recorded_price
    if (item.highest_recorded_price != null) metadata.highest_price = item.highest_recorded_price

    return {
      title:       item.title?.trim() ?? `Product ${barcode}`,
      description: item.description?.slice(0, 1000),
      barcode,
      brand:       item.brand,
      category:    item.category,
      image:       item.images?.[0],
      weight:      item.weight,
      metadata,
    }
  }
}
