import { BARCODE_TYPES } from "../constants"
import type { NormalizedProduct, OpenFactsBaseProviderOptions } from "../types"
import { BaseBarcodeProvider } from "./base"

// Shared response shape for all Open*Facts APIs (same codebase, same schema)
interface OpenFactsProduct {
  product_name?:         string
  product_name_en?:      string
  generic_name?:         string
  brands?:               string
  categories?:           string
  categories_tags?:      string[]
  image_url?:            string
  image_front_url?:      string
  quantity?:             string
  ingredients_text?:     string
  labels?:               string
  countries?:            string
  [key: string]:         unknown
}

interface OpenFactsResponse {
  status:   0 | 1
  product?: OpenFactsProduct
}

/**
 * Abstract base for all Open*Facts APIs (OpenFoodFacts, OpenBeautyFacts,
 * OpenPetFoodFacts, OpenProductsFacts). They share the same REST schema at
 * https://{country}.{host}/api/v0/product/{barcode}.json
 */
export abstract class OpenFactsBaseProvider extends BaseBarcodeProvider {
  protected readonly country: string
  protected abstract readonly host: string

  constructor(
    providerId: string,
    options: OpenFactsBaseProviderOptions,
    defaultPriority: number,
  ) {
    super(providerId, {
      enabled:  options.enabled  ?? true,
      timeout:  options.timeout  ?? 12_000,
      retries:  options.retries  ?? 2,
      priority: options.priority ?? defaultPriority,
    })
    this.country = options.country ?? "world"
  }

  supports(barcodeType: string): boolean {
    return (
      barcodeType === BARCODE_TYPES.EAN13 ||
      barcodeType === BARCODE_TYPES.UPC_A ||
      barcodeType === BARCODE_TYPES.UPC_E
    )
  }

  async lookup(barcode: string): Promise<NormalizedProduct | null> {
    const url = `https://${this.country}.${this.host}/api/v0/product/${barcode}.json`

    return this.withRetry(async () => {
      const res = await this.fetchWithTimeout(url, {
        headers: {
          "User-Agent": "medusa-barcode-plugin/1.0 (https://github.com/adafri)",
          "Accept":     "application/json",
        },
      })

      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error(`${this.host} HTTP ${res.status}`)
      }

      const body = (await res.json()) as OpenFactsResponse
      if (body.status !== 1 || !body.product) return null

      return this.normalise(barcode, body.product)
    })
  }

  private normalise(barcode: string, p: OpenFactsProduct): NormalizedProduct {
    const title =
      p.product_name    ||
      p.product_name_en ||
      p.generic_name    ||
      `Product ${barcode}`

    const category = this.extractCategory(p.categories_tags ?? []) ??
                     p.categories?.split(",")[0]?.trim()

    const metadata: Record<string, unknown> = {}
    if (p.ingredients_text) metadata.ingredients_text = p.ingredients_text
    if (p.labels)           metadata.labels           = p.labels
    if (p.countries)        metadata.countries        = p.countries
    if (p.quantity)         metadata.quantity_text    = p.quantity

    return {
      title:       title.trim(),
      description: p.ingredients_text?.slice(0, 500),
      barcode,
      brand:       p.brands?.split(",")[0]?.trim(),
      category,
      image:       p.image_front_url ?? p.image_url,
      weight:      p.quantity,
      metadata,
    }
  }

  private extractCategory(tags: string[]): string | undefined {
    const enTag = tags.find(t => t.startsWith("en:"))
    if (!enTag) return undefined
    return enTag
      .replace(/^en:/, "")
      .split("-")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  }
}
