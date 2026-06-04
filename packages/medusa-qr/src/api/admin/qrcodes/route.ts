import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { generateQRWorkflow } from "../../../workflows/generate-qr"
import { uploadFiles } from "../../../workflows/upload-file"
import { QR_MODULE } from "../../../modules/qr"
import type { QrService } from "../../../modules/qr/services/qr-service"

/**
 * GET /admin/qrcodes
 * List QR/barcode records.
 * Query: resource_type, resource_id, limit, offset
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const qrService = req.scope.resolve<QrService>(QR_MODULE)
  const { resource_type, resource_id, limit = 20, offset = 0 } = req.query as any

  const filter: Record<string, any> = {}
  if (resource_type) filter.resource_type = resource_type
  if (resource_id)   filter.resource_id   = resource_id

  const qrs = await qrService.listQrs(filter, {
    skip:  Number(offset),
    take:  Number(limit),
    order: { created_at: 'DESC' },
  })

  res.json({ qrs, count: qrs.length })
}

/**
 * POST /admin/qrcodes
 * Generate a single QR/barcode record.
 * Body: { resource_type, resource_id, action?, enable_qr?, enable_code128?, enable_ean13? }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result: qr } = await generateQRWorkflow(req.scope).run({
    input: {
      input:  req.body as any,
      upload: uploadFiles,
    },
  })

  res.status(201).json({ qr })
}
