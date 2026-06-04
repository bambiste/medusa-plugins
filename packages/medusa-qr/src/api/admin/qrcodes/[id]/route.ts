import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QR_MODULE } from "../../../../modules/qr"
import type { QrService } from "../../../../modules/qr/services/qr-service"
import { generateQRWorkflow } from "../../../../workflows/generate-qr"
import { uploadFiles } from "../../../../workflows/upload-file"

/**
 * GET /admin/qrcodes/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const qrService = req.scope.resolve<QrService>(QR_MODULE)
  const [qr] = await qrService.listQrs({ id: req.params.id })
  if (!qr) return res.status(404).json({ message: 'Not found' })
  res.json({ qr })
}

/**
 * POST /admin/qrcodes/:id/regenerate
 * Re-generates all codes for an existing record (same resource, new codes).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const qrService = req.scope.resolve<QrService>(QR_MODULE)
  const [existing] = await qrService.listQrs({ id: req.params.id })
  if (!existing) return res.status(404).json({ message: 'Not found' })

  // Delete old record and generate fresh codes
  await qrService.deleteQrs([existing.id])

  const { result: qr } = await generateQRWorkflow(req.scope).run({
    input: {
      input: {
        resource_type: existing.resource_type,
        resource_id:   existing.resource_id,
        action:        existing.action,
      },
      upload: uploadFiles,
    },
  })

  res.json({ qr })
}

/**
 * DELETE /admin/qrcodes/:id
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const qrService = req.scope.resolve<QrService>(QR_MODULE)
  await qrService.deleteQrs([req.params.id])
  res.json({ deleted: true, id: req.params.id })
}
