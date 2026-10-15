import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z }                             from "zod"
import { Modules }                       from "@medusajs/framework/utils"
import { BARCODE_MODULE }                from "../../../../modules/barcode/index.js"
import { parseBarcode }                  from "../../../../modules/barcode/utils/barcode-parser.js"
import { lookupAndCreateProductWorkflow } from "../../../../workflows/lookup-and-create-product.js"
import type { BarcodeService }           from "../../../../modules/barcode/service.js"

// ─── Validation ───────────────────────────────────────────────────────────────

const VariantPriceSchema = z.object({
  currency_code: z.string().min(3).max(3).toLowerCase(),
  amount:        z.number().int().nonnegative(),
})

const CreateFromBarcodeSchema = z.object({
  barcode:             z.string().min(1).max(100).trim(),
  prices:              z.array(VariantPriceSchema).optional(),
  salesChannelIds:     z.array(z.string()).optional(),
  categoryIds:         z.array(z.string()).optional(),
  collectionId:        z.string().optional(),
  publishImmediately:  z.boolean().optional().default(false),
  skipCache:           z.boolean().optional().default(false),
})

// ─── POST /admin/barcodes/create-from-barcode ─────────────────────────────────

/**
 * Lookup a barcode and create (or return existing) a Medusa product.
 *
 * Body:
 *   {
 *     "barcode": "3017620422003",
 *     "salesChannelIds"?: ["sc_xxx"],
 *     "categoryIds"?: ["pcat_xxx"],
 *     "collectionId"?: "pcol_xxx",
 *     "publishImmediately"?: false
 *   }
 *
 * Response (201 created):
 *   { "created": true,  "product_id": "prod_xxx", "variant_id": "variant_xxx", "provider": "open-food-facts" }
 *
 * Response (200 existing):
 *   { "created": false, "existing": true, "product_id": "prod_xxx", "variant_id": "variant_xxx" }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parse = CreateFromBarcodeSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error:   "Validation failed",
      details: parse.error.flatten().fieldErrors,
    })
  }

  const { barcode, prices, salesChannelIds, categoryIds, collectionId, publishImmediately, skipCache } = parse.data

  // Validate barcode format
  const parsed = parseBarcode(barcode)
  if (!parsed.isValid) {
    return res.status(422).json({
      error:       "Invalid barcode format",
      message:     parsed.error,
      barcodeType: parsed.type,
    })
  }

  // Short-circuit if this barcode is already linked to an existing Medusa product
  const svc = req.scope.resolve<BarcodeService>(BARCODE_MODULE)
  const existingMapping = await svc.findBarcodeProduct(parsed.normalized)
  if (existingMapping) {
    // Verify the referenced Medusa product still exists
    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      listProducts(filters: object): Promise<Array<{ id: string }>>
    }
    const [liveProduct] = await productModule.listProducts({ id: [existingMapping.product_id] })
      .catch(() => [null])

    if (liveProduct) {
      return res.status(200).json({
        created:    false,
        existing:   true,
        product_id: existingMapping.product_id,
        variant_id: existingMapping.variant_id ?? null,
        provider:   existingMapping.source_provider ?? null,
      })
    }

    // Product was deleted, remove the stale mapping + cache and fall through to creation
    await svc.removeBarcodeProduct(parsed.normalized).catch(() => {})
    await svc.invalidateCache(parsed.normalized).catch(() => {})
  }

  // Run the full orchestration workflow
  const { result } = await lookupAndCreateProductWorkflow(req.scope).run({
    input: {
      barcode:             parsed.normalized,
      prices,
      salesChannelIds,
      categoryIds,
      collectionId,
      publishImmediately,
      skipCache,
    },
  })

  return res.status(201).json({
    created:    result.created,
    existing:   result.existing,
    product_id: result.product_id,
    variant_id: result.variant_id ?? null,
    provider:   result.provider,
    title:      result.title,
  })
}
