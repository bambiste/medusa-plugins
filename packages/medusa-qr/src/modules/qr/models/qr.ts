import { model } from "@medusajs/framework/utils"

export const Qr = model.define("qr", {
  id: model.id().primaryKey(),

  /** nanoid — serves as both the Code128 barcode value and the QR URL token */
  code: model.text().unique(),

  resource_type: model.text(),   // 'product' | 'variant'
  resource_id:   model.text(),   // product.id or variant.id

  type:   model.enum(["static", "dynamic"]).default("dynamic"),
  action: model.enum(["view", "add_to_cart", "verify"]).default("view"),

  payload: model.json(),

  /** Uploaded QR code image URL */
  qr_code: model.text(),

  /** Uploaded Code128 barcode image URL */
  code128: model.text().nullable(),

  /** Uploaded EAN-13 barcode image URL */
  ean13: model.text().nullable(),

  /** Raw 13-digit EAN-13 number used for scanner lookup (e.g. "1234567890128") */
  ean13_value: model.text().nullable(),

  scan_count:     model.number().default(0),
  last_scanned_at: model.dateTime().nullable(),
  expires_at:     model.dateTime().nullable(),
})

export default Qr
