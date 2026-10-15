import { model } from "@medusajs/framework/utils"

/**
 * Permanent relationship between a scanned barcode and the Medusa product
 * (and optional variant) that was created from it.
 */
export const BarcodeProduct = model.define("barcode_product", {
  id:               model.id().primaryKey(),
  /** The raw normalised barcode string (EAN-13, UPC-A, Code128 ...) */
  barcode:          model.text().unique(),
  /** Medusa product.id */
  product_id:       model.text(),
  /** Optional Medusa variant.id */
  variant_id:       model.text().nullable(),
  /** Provider that supplied the product data */
  source_provider:  model.text().nullable(),
  /** 0-1 confidence score (1 = exact match from provider) */
  confidence_score: model.number().nullable(),
})

export default BarcodeProduct
