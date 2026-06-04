import { model } from "@medusajs/framework/utils"

/**
 * Local cache of raw provider responses + their normalised form.
 * Indexed by (barcode, provider) with an optional TTL column.
 */
export const BarcodeCache = model.define("barcode_cache", {
  id:              model.id().primaryKey(),
  barcode:         model.text(),
  provider:        model.text(),
  raw_response:    model.json(),
  normalized_data: model.json().nullable(),
  expires_at:      model.dateTime().nullable(),
})

export default BarcodeCache
