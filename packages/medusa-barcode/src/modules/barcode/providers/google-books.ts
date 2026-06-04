import { BARCODE_TYPES, PROVIDER_IDS } from "../constants"
import type { GoogleBooksProviderOptions, NormalizedProduct } from "../types"
import { BaseBarcodeProvider } from "./base"

interface GoogleBooksVolume {
  volumeInfo?: {
    title?:               string
    subtitle?:            string
    authors?:             string[]
    publisher?:           string
    description?:         string
    categories?:          string[]
    imageLinks?: {
      thumbnail?:         string
      smallThumbnail?:    string
    }
    industryIdentifiers?: Array<{ type: string; identifier: string }>
    pageCount?:           number
    language?:            string
  }
}

interface GoogleBooksResponse {
  totalItems: number
  items?:     GoogleBooksVolume[]
}

export class GoogleBooksProvider extends BaseBarcodeProvider {
  private readonly apiKey: string | undefined

  constructor(options: GoogleBooksProviderOptions = {}) {
    super(PROVIDER_IDS.GOOGLE_BOOKS, {
      enabled:  options.enabled  ?? true,
      timeout:  options.timeout  ?? 10_000,
      retries:  options.retries  ?? 1,
      priority: options.priority ?? 50,
      apiKey:   options.apiKey,
    })
    this.apiKey = options.apiKey
  }

  // Google Books only makes sense for ISBN-encoded EAN-13 (978/979 prefix)
  supports(barcodeType: string): boolean {
    return barcodeType === BARCODE_TYPES.EAN13
  }

  async lookup(barcode: string): Promise<NormalizedProduct | null> {
    // Skip non-ISBN barcodes early (ISBN-13 starts with 978 or 979)
    if (!barcode.startsWith("978") && !barcode.startsWith("979")) return null

    const params = new URLSearchParams({ q: `isbn:${barcode}` })
    if (this.apiKey) params.set("key", this.apiKey)
    const url = `https://www.googleapis.com/books/v1/volumes?${params}`

    return this.withRetry(async () => {
      const res = await this.fetchWithTimeout(url, {
        headers: { "Accept": "application/json" },
      })

      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error(`Google Books HTTP ${res.status}`)
      }

      const body = (await res.json()) as GoogleBooksResponse
      if (!body.totalItems || !body.items?.length) return null

      const info = body.items[0].volumeInfo
      if (!info) return null

      const title = info.title
        ? (info.subtitle ? `${info.title}: ${info.subtitle}` : info.title)
        : `Book ${barcode}`

      const metadata: Record<string, unknown> = {}
      if (info.pageCount)  metadata.page_count = info.pageCount
      if (info.language)   metadata.language   = info.language
      if (info.publisher)  metadata.publisher  = info.publisher
      if (info.authors?.length) metadata.authors = info.authors.join(", ")

      return {
        title,
        description: info.description?.slice(0, 1000),
        barcode,
        brand:       info.publisher,
        category:    info.categories?.[0] ?? "Books",
        image:       info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail,
        metadata,
      }
    })
  }
}
