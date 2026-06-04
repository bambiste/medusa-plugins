import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { generateQRWorkflow } from '../workflows/generate-qr'
import { uploadFiles } from '../workflows/upload-file'

export default async function handleProductCreated({ event, container }: SubscriberArgs<{ id: string }>) {
  try {
    console.log('[medusa-qr] product.created — generating codes for', event.data.id)
    await generateQRWorkflow(container).run({
      input: {
        input: {
          resource_type: 'product',
          resource_id:   event.data.id,
          action:        'view',
        },
        upload: uploadFiles,
      },
    })
  } catch (err) {
    // Never block product creation if code generation fails
    console.error('[medusa-qr] Failed to generate codes for product', event.data.id, err)
  }
}

export const config: SubscriberConfig = {
  event: 'product.created',
}
