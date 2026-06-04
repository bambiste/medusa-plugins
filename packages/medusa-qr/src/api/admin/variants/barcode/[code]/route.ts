import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { QR_MODULE } from "../../../../../modules/qr"
import type { QrService } from "../../../../../modules/qr/services/qr-service"
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

const PRODUCT_FIELDS = [
  "*",
  'id', 'title', 'subtitle', 'handle', 'thumbnail', 'status', 'description',
  'variants.*',
  'variants.prices.*',
  'options.*',
  'options.values.*',
];

const VARIANT_FIELDS = [
  'id','title','sku','barcode','ean','upc','allow_backorder','manage_inventory','hs_code','origin_country','mid_code','weight','height','width','length','metadata','created_at','deleted_at','thumbnail','variant_rank','product','product_id','images','images.*','tanslations','inventory_quantity','inventory_items','options','options.*','inventory_items.*', 'prices', 'prices.*'
  // '*',
  // 'id', 'title', 'sku', 'barcode', 'allow_backorder', 'manage_inventory',
  // 'prices.*',
  // 'options.*',
  // 'options.values.*',
  // 'product.*',
  // 'product.id',
  // 'product.title',
  // 'product.subtitle',
  // 'product.handle',
  // 'product.thumbnail',
  // 'product.status',
  // 'product.variants.*',
  // 'product.variants.prices.*',
  // 'product.options.*',
  // 'product.options.values.*',
];

/**
 * GET /admin/variants/barcode/:code
 *
 * Look up a product variant by scanning a barcode:
 *   - 13 all-digit string → EAN-13
 *   - anything else       → Code128 / QR code token
 *
 * Returns the variant with product + current prices.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { code } = req.params
  if (!code) return res.status(400).json({ message: 'code is required' })

  const qrService = req.scope.resolve<QrService>(QR_MODULE)

  let qr: any
  try {
    qr = await qrService.resolve(decodeURIComponent(code))
  } catch(e) {
    console.log('error when loading qr', e)
    return res.status(404).json({ message: `No barcode record found for: ${code}` })
  }

  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const barcodeType = /^\d{13}$/.test(code) ? 'ean13' : 'code128'
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  // ── Product QR ────────────────────────────────────────────────────────────
  if (qr.resource_type === 'product') {
    try {
      const { data: products } = await query.graph({
        entity: "product",
        fields: PRODUCT_FIELDS,
        filters: {
          id: [qr.resource_id]
        }
      })
      // const { data: variants } = await query.graph({
      //   entity: "productVariant",
      //   fields: VARIANT_FIELDS,
      //   filters: {
      //     id: qr.resource_id
      //   }
      // })
      const product = products.length>0 ? products[0] : null
      // const [product] = await (productModuleService as any).listProducts(
      //   { id: qr.resource_id },
      //   { relations: PRODUCT_FIELDS, take: 1 }
      // )
      return res.json({ qr, variant: null, product: product ?? null, barcode_type: barcodeType })
    } catch (err: any) {
      return res.json({ qr, variant: null, product: null, error: err?.message })
    }
  }

  // ── Variant QR ────────────────────────────────────────────────────────────
  try {
      const { data: variants } = await query.graph({
        entity: "variant",
        fields: VARIANT_FIELDS,
        filters: { id: [qr.resource_id] },
      });

    if (variants.length === 0) {
      return res.status(404).json({ message: 'Variant not found in catalog', qr });
    }
    const variant = variants[0];
    const product = variant.product ?? null;

    res.json({ qr, variant, product, barcode_type: barcodeType });
  } catch (err: any) {
    console.log('cannot read variant', err)
    res.json({ qr, variant: null, product: null, error: err?.message })
  }
}
