import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QR_MODULE } from "../../../../modules/qr"
import type { QrService } from "../../../../modules/qr/services/qr-service"

/**
 * GET /store/qrcode/:code
 * Resolves any scanned code (QR token, Code128, EAN-13) and executes its action.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { code } = req.params
  const qrService = req.scope.resolve<QrService>(QR_MODULE)

  let qr: any
  try {
    qr = await qrService.resolve(code)
  } catch {
    return res.status(404).json({ message: 'QR / barcode not found' })
  }

  const result = await qrService.execute(qr)

  if (result.type === 'redirect') {
    return res.redirect(result.url!)
  }

  res.json({ ...result, qr: { code: qr.code, resource_type: qr.resource_type, resource_id: qr.resource_id } })
}
