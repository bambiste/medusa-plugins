// Module definition (default export required for Medusa plugin resolution)
export { default } from "./modules/barcode/index.js"
export { BARCODE_MODULE } from "./modules/barcode/index.js"

// Re-export service and types for consumers
export { BarcodeService, type BarcodeServiceType } from "./modules/barcode/service.js"
export * from "./modules/barcode/types.js"
export * from "./modules/barcode/constants.js"

// Workflows
export { lookupAndCreateProductWorkflow, batchBarcodeImportWorkflow } from "./workflows/index.js"

// Providers (for custom provider extension)
export {
  BaseBarcodeProvider,
  ProviderRegistry,
  OpenFoodFactsProvider,
  OpenBeautyFactsProvider,
  OpenPetFoodFactsProvider,
  OpenProductsFactsProvider,
  GoogleBooksProvider,
  EanSearchProvider,
  BarcodeLookupProvider,
  UpcItemDbProvider,
} from "./modules/barcode/providers/index.js"

// Utilities
export { parseBarcode, computeEan13CheckDigit, upcToEan13 } from "./modules/barcode/utils/barcode-parser.js"
export { sanitizeNormalized, normalizeCategory, buildProductMetadata } from "./modules/barcode/utils/normalize-product.js"
