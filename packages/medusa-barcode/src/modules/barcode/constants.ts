export const BARCODE_MODULE = "barcode" as const

export const DEFAULT_CACHE_TTL_SECONDS = 86_400      // 24 h
export const DEFAULT_LOOKUP_TIMEOUT_MS  = 10_000     // 10 s per provider
export const DEFAULT_LOOKUP_RETRIES     = 2
export const DEFAULT_PROVIDER_PRIORITY  = 100

export const BARCODE_TYPES = {
  EAN13:      "ean13",
  UPC_A:      "upc-a",
  UPC_E:      "upc-e",
  CODE128:    "code128",
  QR:         "qr",
  DATAMATRIX: "datamatrix",
  UNKNOWN:    "unknown",
} as const

export type BarcodeTypeKey = keyof typeof BARCODE_TYPES
export type BarcodeTypeValue = (typeof BARCODE_TYPES)[BarcodeTypeKey]

export const PROVIDER_IDS = {
  OPEN_FOOD_FACTS:    "open-food-facts",
  OPEN_BEAUTY_FACTS:  "open-beauty-facts",
  OPEN_PET_FOOD_FACTS:"open-pet-food-facts",
  OPEN_PRODUCTS_FACTS:"open-products-facts",
  GOOGLE_BOOKS:       "google-books",
  EAN_SEARCH:         "ean-search",
  BARCODE_LOOKUP:     "barcode-lookup",
  UPC_ITEM_DB:        "upc-item-db",
} as const

export const BARCODE_EVENTS = {
  LOOKUP_SUCCESS:  "barcode.lookup.success",
  LOOKUP_FAILED:   "barcode.lookup.failed",
  PRODUCT_CREATED: "barcode.product.created",
  CACHE_HIT:       "barcode.cache.hit",
  CACHE_MISS:      "barcode.cache.miss",
} as const
