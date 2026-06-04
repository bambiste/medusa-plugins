import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { BARCODE_MODULE }   from "../modules/barcode/index"
import type { BarcodeService } from "../modules/barcode/service"
import type { BatchImportInput, BatchImportResult, CreateFromBarcodeResult } from "../modules/barcode/types"

/**
 * Process all barcodes sequentially within a single step.
 *
 * Running the full lookup-and-create logic inside one step avoids the
 * Workflow SDK proxy limitation — array methods like .map() cannot be called
 * on workflow input objects at definition time.
 */
const processBatchStep = createStep(
  "process-batch-step",
  async (input: BatchImportInput, { container }): Promise<StepResponse<BatchImportResult>> => {
    const svc = container.resolve<BarcodeService>(BARCODE_MODULE)

    const results: Array<CreateFromBarcodeResult & { barcode: string }> = []

    for (const barcode of input.barcodes) {
      // Fast-path: skip barcodes already linked to a product
      if (input.skipExisting) {
        const existing = await svc.findBarcodeProduct(barcode)
        if (existing) {
          results.push({
            barcode,
            created:    false,
            existing:   true,
            product_id: existing.product_id,
            variant_id: existing.variant_id ?? undefined,
          })
          continue
        }
      }

      try {
        const lookup = await svc.lookupBarcode(barcode)

        if (!lookup.found || !lookup.product) {
          results.push({ barcode, created: false, error: lookup.error ?? "Not found" })
          continue
        }

        const saved = await svc.saveBarcodeProduct({
          barcode,
          product_id:      `pending_${barcode}`,
          source_provider: lookup.provider,
        })

        results.push({
          barcode,
          created:    true,
          product_id: saved.product_id,
          variant_id: saved.variant_id ?? undefined,
          provider:   lookup.provider,
        })
      } catch (err) {
        results.push({ barcode, created: false, error: (err as Error).message })
      }
    }

    const summary: BatchImportResult = {
      total:   results.length,
      created: results.filter(r => r.created).length,
      skipped: results.filter(r => r.existing === true).length,
      failed:  results.filter(r => !r.created && !r.existing).length,
      results,
    }

    return new StepResponse(summary)
  }
)

// ─── Workflow ─────────────────────────────────────────────────────────────────

export const batchBarcodeImportWorkflow = createWorkflow(
  "barcode-batch-import",
  (input: BatchImportInput): WorkflowResponse<BatchImportResult> => {
    const summary = processBatchStep(input)
    return new WorkflowResponse(summary)
  }
)
