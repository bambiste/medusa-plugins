import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BARCODE_MODULE }                from "../../../../modules/barcode/index.js"
import { parseBarcode }                  from "../../../../modules/barcode/utils/barcode-parser.js"
import type { BarcodeService }           from "../../../../modules/barcode/service.js"

// ─── GET /admin/barcodes/:barcode ─────────────────────────────────────────────

/**
 * Retrieve the BarcodeProduct + cached lookup data for a specific barcode.
 *
 * Response:
 *   {
 *     "barcodeProduct": { id, barcode, product_id, ... } | null,
 *     "cache":          { barcode, provider, normalized_data, expires_at } | null,
 *     "parsed":         { raw, normalized, type, isValid }
 *   }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const raw = (req.params as { barcode: string }).barcode
  const svc = req.scope.resolve<BarcodeService>(BARCODE_MODULE)

  const parsed          = parseBarcode(raw)
  const barcodeProduct  = await svc.findBarcodeProduct(raw)

  // Also surface the latest cache entry (for freshness info)
  const cacheEntries = await svc.listBarcodeCaches(
    { barcode: parsed.normalized },
    { order: { created_at: "DESC" }, take: 1 }
  )

  return res.status(200).json({
    parsed:         parsed,
    barcodeProduct: barcodeProduct ?? null,
    cache:          cacheEntries[0] ?? null,
  })
}

// ─── DELETE /admin/barcodes/:barcode ─────────────────────────────────────────

/**
 * Remove the BarcodeProduct relation and invalidate the cache for a barcode.
 * Does NOT delete the Medusa product itself.
 *
 * Response: { "success": true }
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const raw = (req.params as { barcode: string }).barcode
  const svc = req.scope.resolve<BarcodeService>(BARCODE_MODULE)

  await svc.removeBarcodeProduct(raw)
  await svc.invalidateCache(raw)

  return res.status(200).json({ success: true })
}
