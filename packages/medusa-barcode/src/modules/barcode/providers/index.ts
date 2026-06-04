import type { BaseBarcodeProvider } from "./base"
import { OpenFoodFactsProvider }     from "./open-food-facts"
import { OpenBeautyFactsProvider }   from "./open-beauty-facts"
import { OpenPetFoodFactsProvider }  from "./open-pet-food-facts"
import { OpenProductsFactsProvider } from "./open-products-facts"
import { GoogleBooksProvider }       from "./google-books"
import { EanSearchProvider }         from "./ean-search"
import { BarcodeLookupProvider }     from "./barcode-lookup"
import { UpcItemDbProvider }         from "./upcitemdb"
import type {
  BarcodeModuleProviderOptions,
  NormalizedProduct,
  ProviderLookupResult,
} from "../types"

export { BaseBarcodeProvider }        from "./base"
export { OpenFoodFactsProvider }      from "./open-food-facts"
export { OpenBeautyFactsProvider }    from "./open-beauty-facts"
export { OpenPetFoodFactsProvider }   from "./open-pet-food-facts"
export { OpenProductsFactsProvider }  from "./open-products-facts"
export { GoogleBooksProvider }        from "./google-books"
export { EanSearchProvider }          from "./ean-search"
export { BarcodeLookupProvider }      from "./barcode-lookup"
export { UpcItemDbProvider }          from "./upcitemdb"

/**
 * In-process registry that manages all registered providers.
 *
 * Providers are stored in insertion order and sorted by priority on retrieval.
 * Custom providers can be registered at runtime via `register()`.
 */
export class ProviderRegistry {
  private readonly map: Map<string, BaseBarcodeProvider> = new Map()

  /** Register (or replace) a provider. */
  register(provider: BaseBarcodeProvider): void {
    this.map.set(provider.providerId, provider)
  }

  /** Unregister a provider by its ID. */
  unregister(providerId: string): void {
    this.map.delete(providerId)
  }

  /** All enabled providers sorted ascending by priority (lower = first). */
  getEnabled(): BaseBarcodeProvider[] {
    return Array.from(this.map.values())
      .filter(p => p.isEnabled())
      .sort((a, b) => a.getPriority() - b.getPriority())
  }

  /** Get a specific provider by ID (or undefined if not registered). */
  get(id: string): BaseBarcodeProvider | undefined {
    return this.map.get(id)
  }

  /** All registered providers regardless of enabled state. */
  getAll(): BaseBarcodeProvider[] {
    return Array.from(this.map.values())
  }

  /**
   * Instantiate the default providers from the module options and return a
   * ready-to-use registry.
   *
   * Lookup order (by ascending priority):
   *   10  OpenFoodFacts      — free, no key
   *   20  OpenBeautyFacts    — free, no key
   *   30  OpenPetFoodFacts   — free, no key
   *   40  OpenProductsFacts  — free, no key
   *   50  GoogleBooks        — free (quota raised with apiKey)
   *   60  EanSearch          — rate-limited, requires apiKey (auto-disabled when absent)
   *   70  BarcodeLookup      — rate-limited, requires apiKey (auto-disabled when absent)
   *   80  UpcItemDb          — rate-limited / paid, tried last
   */
  static fromOptions(options: BarcodeModuleProviderOptions = {}): ProviderRegistry {
    const registry = new ProviderRegistry()

    // ── Free APIs ─────────────────────────────────────────────────────────────
    const offOpts = options.openFoodFacts ?? {}
    if (offOpts.enabled !== false) {
      registry.register(new OpenFoodFactsProvider(offOpts))
    }

    const obfOpts = options.openBeautyFacts ?? {}
    if (obfOpts.enabled !== false) {
      registry.register(new OpenBeautyFactsProvider(obfOpts))
    }

    const opffOpts = options.openPetFoodFacts ?? {}
    if (opffOpts.enabled !== false) {
      registry.register(new OpenPetFoodFactsProvider(opffOpts))
    }

    const oprodOpts = options.openProductsFacts ?? {}
    if (oprodOpts.enabled !== false) {
      registry.register(new OpenProductsFactsProvider(oprodOpts))
    }

    const gbOpts = options.googleBooks ?? {}
    if (gbOpts.enabled !== false) {
      registry.register(new GoogleBooksProvider(gbOpts))
    }

    // ── Rate-limited / API-key APIs ───────────────────────────────────────────
    const esOpts = options.eanSearch ?? {}
    // Auto-disabled unless an apiKey is provided
    if (esOpts.enabled !== false && esOpts.apiKey) {
      registry.register(new EanSearchProvider(esOpts))
    }

    const blOpts = options.barcodeLookup ?? {}
    if (blOpts.enabled !== false && blOpts.apiKey) {
      registry.register(new BarcodeLookupProvider(blOpts))
    }

    const upcOpts = options.upcItemDb ?? {}
    if (upcOpts.enabled !== false) {
      registry.register(new UpcItemDbProvider(upcOpts))
    }

    return registry
  }
}

/**
 * Query every enabled, compatible provider in priority order.
 *
 * Returns on the first successful (non-null) result.
 * Logs provider errors and continues the fallback chain.
 */
export async function runProviderFallbackChain(
  registry:    ProviderRegistry,
  barcode:     string,
  barcodeType: string,
  logger:      { info(msg: string): void; error(msg: string, err?: unknown): void }
): Promise<ProviderLookupResult> {
  const providers = registry.getEnabled().filter(p => p.supports(barcodeType))

  for (const provider of providers) {
    try {
      const product = await provider.lookup(barcode)
      if (product) {
        logger.info(`[barcode] Provider "${provider.providerId}" found ${barcode}`)
        return { provider: provider.providerId, found: true, product }
      }
    } catch (err) {
      logger.error(
        `[barcode] Provider "${provider.providerId}" failed for ${barcode}: ${(err as Error).message}`,
        err
      )
    }
  }

  return { provider: "none", found: false }
}

/** Download a product image URL to an in-memory Buffer (for re-upload). */
export async function downloadImage(
  url:       string,
  timeoutMs: number = 15_000
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(tid)

    if (!res.ok) return null

    const contentType = res.headers.get("content-type") ?? "image/jpeg"
    const arrayBuf = await res.arrayBuffer()
    return { buffer: Buffer.from(arrayBuf), contentType }
  } catch {
    return null
  }
}

/** Re-export NormalizedProduct so consumers don't need a second import path. */
export type { NormalizedProduct }
