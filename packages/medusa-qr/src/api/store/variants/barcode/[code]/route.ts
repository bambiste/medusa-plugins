import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { QR_MODULE } from "../../../../../modules/qr"
import type { QrService } from "../../../../../modules/qr/services/qr-service"

/**
 * GET /store/variants/barcode/:code
 * Public endpoint for POS / storefront barcode scanning.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { code } = req.params
  if (!code) return res.status(400).json({ message: 'code is required' })

  const qrService = req.scope.resolve<QrService>(QR_MODULE)

  let qr: any
  try {
    qr = await qrService.resolve(code)
  } catch {
    return res.status(404).json({ message: `No barcode record found for: ${code}` })
  }

  const action = await qrService.execute(qr)

  if (qr.resource_type !== 'variant') {
    return res.json({ action, qr: { code: qr.code, resource_type: qr.resource_type, resource_id: qr.resource_id } })
  }

  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT)
    const [variant] = await (productModuleService as any).listProductVariants(
      { id: qr.resource_id },
      { relations: ['product', 'prices'], take: 1 }
    )

    res.json({
      action,
      barcode_type: /^\d{13}$/.test(code) ? 'ean13' : 'code128',
      variant:      variant ?? null,
      product:      variant?.product ?? null,
    })
  } catch {
    res.json({ action, variant: null, product: null })
  }
}
