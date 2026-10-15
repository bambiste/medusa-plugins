import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { Modules } from '@medusajs/framework/utils'
import { generateQRWorkflow } from '../workflows/generate-qr'
import { uploadFiles } from '../workflows/upload-file'
import { QR_MODULE } from '../modules/qr'
import type { QrService } from '../modules/qr/services/qr-service'

export default async function handleVariantCreated({ event, container }: SubscriberArgs<{ id: string }>) {
  const variantId = event.data.id
  try {
    // Skip if QR records already exist for this variant (idempotency, don't override)
    const qrService = container.resolve<QrService>(QR_MODULE)
    const existing = await qrService.listByResource('variant', variantId)
    if (existing.length > 0) {
      console.log('[medusa-qr] QR already exists for variant', variantId, ', skipping')
      return
    }

    // Check if the variant already has a real-world EAN-13 barcode (set by medusa-barcode)
    const productModule = container.resolve(Modules.PRODUCT) as {
      listProductVariants(
        filters: object,
        config?: { select?: string[] }
      ): Promise<Array<{ id: string; barcode?: string | null }>>
    }
    const [variant] = await productModule.listProductVariants(
      { id: [variantId] },
      { select: ['id', 'barcode'] }
    ).catch(() => [null])

    const existingEAN13 = (variant?.barcode && /^\d{13}$/.test(variant.barcode))
      ? variant.barcode
      : undefined

    console.log('[medusa-qr] product-variant.created, generating codes for variant', variantId,
      existingEAN13 ? `(reusing EAN-13: ${existingEAN13})` : '(generating new EAN-13)')

    await generateQRWorkflow(container).run({
      input: {
        input:   { resource_type: 'variant', resource_id: variantId, action: 'add_to_cart' },
        upload:  uploadFiles,
        options: { existing_ean13: existingEAN13 },
      },
    })
  } catch (err) {
    console.error('[medusa-qr] Failed to generate codes for variant', variantId, err)
  }
}

export const config: SubscriberConfig = {
  event: 'product-variant.created',
}
