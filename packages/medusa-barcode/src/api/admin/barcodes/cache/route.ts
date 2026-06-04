import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z }                             from "zod"
import { BARCODE_MODULE }                from "../../../../modules/barcode/index.js"
import type { BarcodeService }           from "../../../../modules/barcode/service.js"

// ─── GET /admin/barcodes/cache ────────────────────────────────────────────────

/**
 * Return cache statistics.
 * Response: { "total": N, "expired": M }
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc   = req.scope.resolve<BarcodeService>(BARCODE_MODULE)
  const stats = await svc.cacheStats()
  return res.status(200).json(stats)
}

// ─── DELETE /admin/barcodes/cache ─────────────────────────────────────────────

/**
 * Purge all expired cache entries.
 * Response: { "purged": N }
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc    = req.scope.resolve<BarcodeService>(BARCODE_MODULE)
  const purged = await svc.purgeExpiredCache()
  return res.status(200).json({ purged })
}
