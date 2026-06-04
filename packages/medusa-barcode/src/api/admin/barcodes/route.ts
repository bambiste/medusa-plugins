import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z }                             from "zod"
import { BARCODE_MODULE }                from "../../../modules/barcode/index.js"
import type { BarcodeService }           from "../../../modules/barcode/service.js"

// ─── GET /admin/barcodes ──────────────────────────────────────────────────────

/**
 * List all BarcodeProduct records.
 * Query: limit, offset, product_id, provider
 *
 * Response:
 *   { "barcodes": [...], "count": N }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { limit = 20, offset = 0, product_id, provider } = req.query as Record<string, string>

  const svc = req.scope.resolve<BarcodeService>(BARCODE_MODULE)

  const filters: Record<string, unknown> = {}
  if (product_id) filters.product_id = product_id

  const barcodes = await svc.listBarcodeProducts(filters, {
    take:  Number(limit),
    skip:  Number(offset),
    order: { created_at: "DESC" },
  })

  return res.status(200).json({ barcodes, count: barcodes.length })
}
