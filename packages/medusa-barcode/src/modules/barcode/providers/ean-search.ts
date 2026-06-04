import { BARCODE_TYPES, PROVIDER_IDS } from "../constants"
import type { EanSearchProviderOptions, NormalizedProduct } from "../types"
import { BaseBarcodeProvider } from "./base"

// https://www.ean-search.org/perl/api-doc.pl
interface EanSearchItem {
  ean?:           string
  name?:          string
  categoryId?:    string
  categoryName?:  string
  issuingCountry?: string
  lang?:          string
  descr?:         string
  [key: string]:  unknown
}

export class EanSearchProvider extends BaseBarcodeProvider {
  private readonly apiKey: string | undefined

  constructor(options: EanSearchProviderOptions = {}) {
    super(PROVIDER_IDS.EAN_SEARCH, {
      enabled:  options.enabled  ?? (options.apiKey != null),
      timeout:  options.timeout  ?? 10_000,
      retries:  options.retries  ?? 1,
      priority: options.priority ?? 60,
      apiKey:   options.apiKey,
    })
    this.apiKey = options.apiKey
  }

  supports(barcodeType: string): boolean {
    return (
      barcodeType === BARCODE_TYPES.EAN13 ||
      barcodeType === BARCODE_TYPES.UPC_A ||
      barcodeType === BARCODE_TYPES.UPC_E
    )
  }

  async lookup(barcode: string): Promise<NormalizedProduct | null> {
    if (!this.apiKey) return null

    const params = new URLSearchParams({
      token:  this.apiKey,
      op:     "barcode-lookup",
      ean:    barcode,
      format: "json",
      lang:   "1", // EN
    })
    const url = `https://api.ean-search.org/api?${params}`

    return this.withRetry(async () => {
      const res = await this.fetchWithTimeout(url, {
        headers: { "Accept": "application/json" },
      })

      if (res.status === 429) throw new Error("EAN-Search rate limit exceeded")
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error(`EAN-Search HTTP ${res.status}`)
      }

      // API returns [] when not found, or [{...}] on success
      const body = (await res.json()) as EanSearchItem[] | { error?: string }
      if (!Array.isArray(body) || !body.length) return null

      const item = body[0]
      const metadata: Record<string, unknown> = {}
      if (item.categoryId)      metadata.ean_category_id   = item.categoryId
      if (item.issuingCountry)  metadata.issuing_country    = item.issuingCountry

      return {
        title:    item.name?.trim() ?? `Product ${barcode}`,
        description: item.descr?.slice(0, 500),
        barcode,
        category: item.categoryName,
        metadata,
      }
    })
  }
}
