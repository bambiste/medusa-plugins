import { BARCODE_EVENTS } from "../modules/barcode/constants"

interface SubscriberArgs {
  event: {
    name: string
    data: {
      product_id: string
      barcode:    string
      provider:   string
    }
  }
  container: {
    resolve<T>(token: string): T
  }
}

/**
 * Subscriber for `barcode.product.created`.
 *
 * Hook into this event to trigger downstream actions:
 *   - Inventory auto-linking
 *   - Supplier matching
 *   - Webhook fanout to external systems
 *   - AI category inference enrichment
 */
export default async function barcodeProductCreatedSubscriber({
  event,
  container,
}: SubscriberArgs) {
  const { product_id, barcode, provider } = event.data

  console.info(
    `[medusa-barcode] Product created from barcode. ` +
    `product_id=${product_id}, barcode=${barcode}, provider=${provider}`
  )

  // Extend here, e.g. emit a webhook, create an inventory record, etc.
}

export const config = {
  event: BARCODE_EVENTS.PRODUCT_CREATED,
}
