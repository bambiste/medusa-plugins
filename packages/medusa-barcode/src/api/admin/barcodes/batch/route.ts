import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z }                             from "zod"
import { batchBarcodeImportWorkflow }    from "../../../../workflows/batch-import.js"

// ─── Validation ───────────────────────────────────────────────────────────────

const BatchImportSchema = z.object({
  barcodes:            z.array(z.string().min(1).max(100).trim()).min(1).max(200),
  salesChannelIds:     z.array(z.string()).optional(),
  categoryIds:         z.array(z.string()).optional(),
  publishImmediately:  z.boolean().optional().default(false),
  skipExisting:        z.boolean().optional().default(true),
})

// ─── POST /admin/barcodes/batch ───────────────────────────────────────────────

/**
 * Batch-import up to 200 barcodes, creating a Medusa product for each.
 *
 * Body:
 *   {
 *     "barcodes": ["3017620422003", "012000161155"],
 *     "salesChannelIds"?: [],
 *     "skipExisting"?: true
 *   }
 *
 * Response:
 *   {
 *     "total": 2, "created": 2, "skipped": 0, "failed": 0,
 *     "results": [...]
 *   }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parse = BatchImportSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error:   "Validation failed",
      details: parse.error.flatten().fieldErrors,
    })
  }

  const { result } = await batchBarcodeImportWorkflow(req.scope).run({
    input: parse.data,
  })

  return res.status(207).json(result)
}
