import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z }                             from "zod"
import { BARCODE_MODULE }                from "../../../../modules/barcode/index.js"
import { parseBarcode }                  from "../../../../modules/barcode/utils/barcode-parser.js"
import type { BarcodeService }           from "../../../../modules/barcode/service.js"

// ─── Validation ───────────────────────────────────────────────────────────────

const LookupBarcodeSchema = z.object({
  barcode:    z.string().min(1).max(100).trim(),
  skipCache:  z.boolean().optional().default(false),
})

// ─── POST /admin/barcodes/lookup ──────────────────────────────────────────────

/**
 * Lookup a barcode via local cache → provider fallback chain.
 *
 * Body:
 *   { "barcode": "3017620422003", "skipCache"?: false }
 *
 * Response:
 *   {
 *     "found": true,
 *     "fromCache": false,
 *     "provider": "open-food-facts",
 *     "barcodeType": "ean13",
 *     "product": { title, description, brand, … }
 *   }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parse = LookupBarcodeSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error:   "Validation failed",
      details: parse.error.flatten().fieldErrors,
    })
  }

  const { barcode, skipCache } = parse.data

  // Validate barcode format before hitting the service
  const parsed = parseBarcode(barcode)
  if (!parsed.isValid) {
    return res.status(422).json({
      error:        "Invalid barcode format",
      message:      parsed.error,
      barcodeType:  parsed.type,
      raw:          barcode,
    })
  }

  const svc = req.scope.resolve<BarcodeService>(BARCODE_MODULE)

  const result = await svc.lookupBarcode(barcode, { skipCache })

  return res.status(200).json({
    found:       result.found,
    fromCache:   result.fromCache,
    provider:    result.provider,
    barcodeType: parsed.type,
    normalized:  parsed.normalized,
    product:     result.product ?? null,
    error:       result.error ?? null,
  })
}
