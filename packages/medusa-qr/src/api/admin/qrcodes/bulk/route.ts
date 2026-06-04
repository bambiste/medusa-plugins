import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QR_MODULE } from "../../../../modules/qr"
import type { QrService } from "../../../../modules/qr/services/qr-service"
import { uploadFiles } from "../../../../workflows/upload-file"

/**
 * POST /admin/qrcodes/bulk
 * Bulk-generate QR/barcode codes for multiple resources.
 * Body: { items: Array<{ resource_type, resource_id, action? }>, skip_existing?: boolean }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const qrService = req.scope.resolve<QrService>(QR_MODULE)
  const { items = [], skip_existing = true } = req.body as any

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'items array is required' })
  }

  let toGenerate = items
  if (skip_existing) {
    // Skip resources that already have a code
    const existing = await qrService.listQrs(
      { resource_id: items.map((i: any) => i.resource_id) } as any
    )
    const existingIds = new Set(existing.map((e: any) => e.resource_id))
    toGenerate = items.filter((i: any) => !existingIds.has(i.resource_id))
  }

  const results = await qrService.bulkGenerate(toGenerate, {
    container: req.scope,
    upload:    uploadFiles,
  })

  res.status(201).json({ generated: results.length, qrs: results })
}
