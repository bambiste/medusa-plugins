import { BARCODE_TYPES, PROVIDER_IDS } from "../constants"
import type { NormalizedProduct, OpenFoodFactsProviderOptions } from "../types"
import { BaseBarcodeProvider } from "./base"

// ─── Raw API shape (subset we care about) ────────────────────────────────────

interface OFFProductRaw {
  product_name?:         string
  product_name_en?:      string
  generic_name?:         string
  brands?:               string
  categories?:           string
  categories_tags?:      string[]
  image_url?:            string
  image_front_url?:      string
  quantity?:             string
  nutriments?:           Record<string, unknown>
  ingredients_text?:     string
  labels?:               string
  countries?:            string
  [key: string]:         unknown
}

interface OFFResponse {
  status:   0 | 1
  code?:    string
  product?: OFFProductRaw
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class OpenFoodFactsProvider extends BaseBarcodeProvider {
  private readonly country: string

  constructor(options: OpenFoodFactsProviderOptions = {}) {
    super(PROVIDER_IDS.OPEN_FOOD_FACTS, {
      enabled:  options.enabled  ?? true,
      timeout:  options.timeout  ?? 12_000,
      retries:  options.retries  ?? 2,
      priority: options.priority ?? 10,
    })
    this.country = options.country ?? "world"
  }

  /** Open Food Facts covers EAN-13 and UPC-A almost exclusively */
  supports(barcodeType: string): boolean {
    return (
      barcodeType === BARCODE_TYPES.EAN13 ||
      barcodeType === BARCODE_TYPES.UPC_A ||
      barcodeType === BARCODE_TYPES.UPC_E
    )
  }

  async lookup(barcode: string): Promise<NormalizedProduct | null> {
    const url = `https://${this.country}.openfoodfacts.org/api/v0/product/${barcode}.json`

    return this.withRetry(async () => {
      const res = await this.fetchWithTimeout(url, {
        headers: {
          "User-Agent": "medusa-barcode-plugin/1.0 (https://github.com/adafri)",
          "Accept":     "application/json",
        },
      })

      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error(`OpenFoodFacts HTTP ${res.status}`)
      }

      const body = (await res.json()) as OFFResponse

      if (body.status !== 1 || !body.product) {
        return null
      }

      return this.normalise(barcode, body.product)
    })
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private normalise(barcode: string, p: OFFProductRaw): NormalizedProduct {
    const title =
      p.product_name       ||
      p.product_name_en    ||
      p.generic_name       ||
      `Product ${barcode}`

    const category = this.extractCategory(p.categories_tags ?? []) ??
                     p.categories?.split(",")[0]?.trim()

    const metadata: Record<string, unknown> = {}
    if (p.nutriments)        metadata.nutriments        = p.nutriments
    if (p.ingredients_text)  metadata.ingredients_text  = p.ingredients_text
    if (p.labels)            metadata.labels            = p.labels
    if (p.countries)         metadata.countries         = p.countries
    if (p.quantity)          metadata.quantity_text     = p.quantity

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

  /** Pick the most human-readable category from the tags list */
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
