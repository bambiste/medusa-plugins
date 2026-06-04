import { BARCODE_TYPES, PROVIDER_IDS } from "../constants"
import type { BarcodeLookupProviderOptions, NormalizedProduct } from "../types"
import { BaseBarcodeProvider } from "./base"

// https://www.barcodelookup.com/api
interface BarcodeLookupProduct {
  barcode_number?:  string
  title?:           string
  description?:     string
  brand?:           string
  manufacturer?:    string
  category?:        string
  color?:           string
  size?:            string
  weight?:          string
  images?:          string[]
  ingredients?:     string
  [key: string]:    unknown
}

interface BarcodeLookupResponse {
  products?: BarcodeLookupProduct[]
  message?:  string
}

export class BarcodeLookupProvider extends BaseBarcodeProvider {
  private readonly apiKey: string | undefined

  constructor(options: BarcodeLookupProviderOptions = {}) {
    super(PROVIDER_IDS.BARCODE_LOOKUP, {
      enabled:  options.enabled  ?? (options.apiKey != null),
      timeout:  options.timeout  ?? 12_000,
      retries:  options.retries  ?? 1,
      priority: options.priority ?? 70,
      apiKey:   options.apiKey,
    })
    this.apiKey = options.apiKey
  }

  supports(barcodeType: string): boolean {
    return (
      barcodeType === BARCODE_TYPES.EAN13  ||
      barcodeType === BARCODE_TYPES.UPC_A  ||
      barcodeType === BARCODE_TYPES.UPC_E  ||
      barcodeType === BARCODE_TYPES.CODE128
    )
  }

  async lookup(barcode: string): Promise<NormalizedProduct | null> {
    if (!this.apiKey) return null

    const params = new URLSearchParams({
      barcode:   barcode,
      formatted: "y",
      key:       this.apiKey,
    })
    const url = `https://api.barcodelookup.com/v3/products?${params}`

    return this.withRetry(async () => {
      const res = await this.fetchWithTimeout(url, {
        headers: { "Accept": "application/json" },
      })

      if (res.status === 429) throw new Error("BarcodeLookup rate limit exceeded")
      if (res.status === 403) throw new Error("BarcodeLookup invalid/expired API key")
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error(`BarcodeLookup HTTP ${res.status}`)
      }

      const body = (await res.json()) as BarcodeLookupResponse
      if (!body.products?.length) return null

      const p = body.products[0]
      const metadata: Record<string, unknown> = {}
      if (p.color)        metadata.color        = p.color
      if (p.size)         metadata.size         = p.size
      if (p.manufacturer) metadata.manufacturer = p.manufacturer
      if (p.ingredients)  metadata.ingredients  = p.ingredients

      return {
        title:       p.title?.trim() ?? `Product ${barcode}`,
        description: p.description?.slice(0, 1000),
        barcode,
        brand:       p.brand ?? p.manufacturer,
        category:    p.category,
        image:       p.images?.[0],
        weight:      p.weight,
        metadata,
      }
    })
  }
}
