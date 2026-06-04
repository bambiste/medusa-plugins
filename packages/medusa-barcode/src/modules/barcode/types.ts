import type { BarcodeTypeValue } from "./constants"

// ─── Normalized product returned by any provider ─────────────────────────────

export interface NormalizedProduct {
  title:       string
  description?: string
  barcode:     string
  brand?:      string
  category?:   string
  image?:      string
  weight?:     string
  /** Provider-specific raw fields forwarded as metadata */
  metadata?:   Record<string, unknown>
}

// ─── Barcode parsing ──────────────────────────────────────────────────────────

export interface ParsedBarcode {
  raw:               string
  normalized:        string
  type:              BarcodeTypeValue
  isValid:           boolean
  checkDigitValid?:  boolean
  error?:            string
}

// ─── Provider contracts ───────────────────────────────────────────────────────

export interface BarcodeProviderConfig {
  enabled:  boolean
  timeout:  number
  retries:  number
  priority: number
  apiKey?:  string
}

export interface ProviderLookupResult {
  provider: string
  found:    boolean
  product?: NormalizedProduct
  raw?:     Record<string, unknown>
  error?:   string
}

// ─── Lookup service result ────────────────────────────────────────────────────

export interface LookupResult {
  found:     boolean
  fromCache: boolean
  provider?: string
  product?:  NormalizedProduct
  raw?:      Record<string, unknown>
  error?:    string
}

// ─── Module options ───────────────────────────────────────────────────────────

export interface OpenFoodFactsProviderOptions {
  enabled?: boolean
  timeout?: number
  retries?: number
  priority?: number
  /** Locale subdomain, default "world" */
  country?: string
}

export interface UpcItemDbProviderOptions {
  enabled?:  boolean
  timeout?:  number
  retries?:  number
  priority?: number
  apiKey?:   string
}

export interface OpenFactsBaseProviderOptions {
  enabled?:  boolean
  timeout?:  number
  retries?:  number
  priority?: number
  /** Locale subdomain, default "world" */
  country?:  string
}

export interface GoogleBooksProviderOptions {
  enabled?:  boolean
  timeout?:  number
  retries?:  number
  priority?: number
  /** Optional Google API key to raise quota from 1 000 to 10 000 req/day */
  apiKey?:   string
}

export interface EanSearchProviderOptions {
  enabled?:  boolean
  timeout?:  number
  retries?:  number
  priority?: number
  /** EAN-Search.org API token (free tier: 100 lookups/day) */
  apiKey?:   string
}

export interface BarcodeLookupProviderOptions {
  enabled?:  boolean
  timeout?:  number
  retries?:  number
  priority?: number
  /** barcodelookup.com API key */
  apiKey?:   string
}

export interface BarcodeModuleProviderOptions {
  openFoodFacts?:    OpenFoodFactsProviderOptions
  openBeautyFacts?:  OpenFactsBaseProviderOptions
  openPetFoodFacts?: OpenFactsBaseProviderOptions
  openProductsFacts?:OpenFactsBaseProviderOptions
  googleBooks?:      GoogleBooksProviderOptions
  eanSearch?:        EanSearchProviderOptions
  barcodeLookup?:    BarcodeLookupProviderOptions
  upcItemDb?:        UpcItemDbProviderOptions
}

export interface BarcodeModuleCacheOptions {
  /** Time-to-live in seconds. Default: 86400 (24 h) */
  ttl?: number
}

export interface BarcodeModuleOptions {
  /** Renamed from "providers" to avoid conflict with Medusa's reserved providers key */
  providerConfig?: BarcodeModuleProviderOptions
  cache?:          BarcodeModuleCacheOptions
}

// ─── Product creation ─────────────────────────────────────────────────────────

export interface VariantPrice {
  currency_code: string
  amount:        number
}

export interface CreateFromBarcodeInput {
  barcode:             string
  prices?:             VariantPrice[]
  salesChannelIds?:    string[]
  categoryIds?:        string[]
  collectionId?:       string
  publishImmediately?: boolean
  requiredQuantity?:   number
}

export interface CreateFromBarcodeResult {
  created:     boolean
  product_id?: string
  variant_id?: string
  existing?:   boolean
  provider?:   string
  error?:      string
}

// ─── BarcodeCache DB shape ────────────────────────────────────────────────────

export interface BarcodeCacheRecord {
  id:              string
  barcode:         string
  provider:        string
  raw_response:    Record<string, unknown>
  normalized_data: NormalizedProduct | null
  expires_at:      Date | null
  created_at:      Date
  updated_at:      Date
}

// ─── BarcodeProduct DB shape ──────────────────────────────────────────────────

export interface BarcodeProductRecord {
  id:               string
  barcode:          string
  product_id:       string
  variant_id:       string | null
  source_provider:  string | null
  confidence_score: number | null
  created_at:       Date
  updated_at:       Date
}

// ─── Batch import ─────────────────────────────────────────────────────────────

export interface BatchImportInput {
  barcodes:            string[]
  salesChannelIds?:    string[]
  categoryIds?:        string[]
  publishImmediately?: boolean
  skipExisting?:       boolean
}

export interface BatchImportResult {
  total:     number
  created:   number
  skipped:   number
  failed:    number
  results:   Array<CreateFromBarcodeResult & { barcode: string }>
}
