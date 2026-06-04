/**
 * BarcodeResolver — core barcode lookup engine.
 *
 * POS context:  barcode → Medusa variant (product catalog is the source of truth)
 * Warehouse ctx: barcode → Odoo product.product (ERP is the source of truth)
 *
 * Resolution order for POS:
 *   1. Redis cache (TTL 1 h, populated by barcode-cache worker)
 *   2. Medusa productModuleService (by SKU / barcode field)
 *   3. Odoo fallback via ERP mapping table
 *
 * Resolution order for Warehouse:
 *   1. Redis cache (TTL 4 h)
 *   2. Odoo product.product search (barcode field, default_code)
 */

import type { OdooClient } from '../client/odoo-client.js'

export type BarcodeContext = 'pos' | 'warehouse' | 'receiving' | 'stocktake'

export interface ResolvedBarcode {
  barcode:         string
  context:         BarcodeContext
  // Medusa fields (always populated for pos context)
  variantId?:      string
  productId?:      string
  sku?:            string
  title?:          string
  unitPriceCents?: number
  imageUrl?:       string
  // Odoo fields (always populated for warehouse context)
  odooProductId?:  number
  odooProductName?: string
  odooUom?:        string
  // Inventory
  stockedQty?:     number
  availableQty?:   number
  // Meta
  source:          'redis_cache' | 'medusa_db' | 'odoo_db' | 'erp_mapping'
  resolvedAt:      string
}

export interface BarcodeCacheEntry {
  variantId:       string
  productId:       string
  sku:             string
  title:           string
  unitPriceCents:  number
  odooProductId?:  number
  imageUrl?:       string
  cachedAt:        string
}

const CACHE_TTL_POS_S       = 3600   // 1 h
const CACHE_TTL_WAREHOUSE_S = 14400  // 4 h
const CACHE_PREFIX          = 'leuzman:barcode:'

export class BarcodeResolver {
  constructor(
    private container: any,
    private odooClient: OdooClient,
    private redis: any,       // ioredis or compatible client
  ) {}

  async resolve(barcode: string, context: BarcodeContext): Promise<ResolvedBarcode | null> {
    const cacheKey = `${CACHE_PREFIX}${context}:${barcode}`

    // 1. Redis cache
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      const entry: BarcodeCacheEntry = JSON.parse(cached)
      return this._formatFromCache(barcode, context, entry)
    }

    // 2. Context-specific resolution
    let result: ResolvedBarcode | null = null
    if (context === 'pos') {
      result = await this._resolveForPos(barcode)
    } else {
      result = await this._resolveForWarehouse(barcode)
    }

    // 3. Cache the result
    if (result) {
      const ttl = context === 'pos' ? CACHE_TTL_POS_S : CACHE_TTL_WAREHOUSE_S
      await this.redis.setex(cacheKey, ttl, JSON.stringify(result))
    }

    return result
  }

  async invalidate(barcode: string, context?: BarcodeContext): Promise<void> {
    if (context) {
      await this.redis.del(`${CACHE_PREFIX}${context}:${barcode}`)
    } else {
      // Invalidate all contexts
      const keys = await this.redis.keys(`${CACHE_PREFIX}*:${barcode}`)
      if (keys.length) await this.redis.del(...keys)
    }
  }

  async warmCache(barcodes: string[]): Promise<{ warmed: number; failed: number }> {
    let warmed = 0
    let failed = 0
    for (const barcode of barcodes) {
      try {
        await this.resolve(barcode, 'pos')
        warmed++
      } catch {
        failed++
      }
    }
    return { warmed, failed }
  }

  private async _resolveForPos(barcode: string): Promise<ResolvedBarcode | null> {
    const productModule = this.container.resolve('productModuleService') as any
    const inventoryModule = this.container.resolve('inventoryModule') as any

    // Search by SKU (default_code equivalent) or barcode metadata
    const variants = await productModule.listProductVariants(
      { sku: barcode },
      { relations: ['product', 'options'], take: 1 }
    ).catch(() => [])

    if (variants.length) {
      const variant = variants[0]
      let stockedQty: number | undefined
      try {
        const [invItem] = await inventoryModule.listInventoryItems({ variant_id: variant.id })
        if (invItem) {
          const levels = await inventoryModule.listInventoryLevels({ inventory_item_id: invItem.id })
          stockedQty = levels.reduce((s: number, l: any) => s + (l.stocked_quantity ?? 0), 0)
        }
      } catch { /* non-critical */ }

      // Check ERP mapping for odoo product id
      let odooProductId: number | undefined
      try {
        const syncService = this.container.resolve('odooSyncModuleService') as any
        odooProductId = await syncService.getOdooId('variant', variant.id)
      } catch { /* no mapping yet */ }

      return {
        barcode,
        context:         'pos',
        variantId:       variant.id,
        productId:       variant.product_id,
        sku:             variant.sku ?? barcode,
        title:           variant.product?.title ?? '',
        unitPriceCents:  Math.round((variant.calculated_price ?? 0) * 100),
        odooProductId,
        stockedQty,
        availableQty:    stockedQty,
        source:          'medusa_db',
        resolvedAt:      new Date().toISOString(),
      }
    }

    // Fallback: check Odoo and reverse-map
    return this._resolveViaOdoo(barcode, 'pos')
  }

  private async _resolveForWarehouse(barcode: string): Promise<ResolvedBarcode | null> {
    // Warehouse always goes to Odoo first
    try {
      const products = await this.odooClient.rpc<Array<{
        id: number; name: string; uom_id: [number, string]; default_code: string
      }>>(
        'product.product',
        'search_read',
        [[['|', ['barcode', '=', barcode], ['default_code', '=', barcode]]]],
        { fields: ['id', 'name', 'uom_id', 'default_code'], limit: 1 }
      )
      if (!products.length) return null

      const p = products[0]

      // Get quant for available qty
      const quants = await this.odooClient.rpc<Array<{quantity: number; reserved_quantity: number}>>(
        'stock.quant',
        'search_read',
        [[['product_id', '=', p.id], ['location_id.usage', '=', 'internal']]],
        { fields: ['quantity', 'reserved_quantity'] }
      )
      const stockedQty   = quants.reduce((s, q) => s + (q.quantity ?? 0), 0)
      const reservedQty  = quants.reduce((s, q) => s + (q.reserved_quantity ?? 0), 0)
      const availableQty = stockedQty - reservedQty

      return {
        barcode,
        context:          'warehouse',
        sku:              p.default_code ?? barcode,
        odooProductId:    p.id,
        odooProductName:  p.name,
        odooUom:          p.uom_id?.[1],
        stockedQty,
        availableQty,
        source:           'odoo_db',
        resolvedAt:       new Date().toISOString(),
      }
    } catch {
      return null
    }
  }

  private async _resolveViaOdoo(barcode: string, context: BarcodeContext): Promise<ResolvedBarcode | null> {
    try {
      const products = await this.odooClient.rpc<Array<{id: number; name: string; default_code: string}>>(
        'product.product', 'search_read',
        [[['|', ['barcode', '=', barcode], ['default_code', '=', barcode]]]],
        { fields: ['id', 'name', 'default_code'], limit: 1 }
      )
      if (!products.length) return null
      const p = products[0]

      // Try reverse ERP mapping: odoo product → medusa variant
      const syncService = this.container.resolve('odooSyncModuleService') as any
      const mappings = await syncService.listMappings?.({ entity_type: 'variant', odoo_id: p.id })
      const medusaVariantId: string | undefined = mappings?.[0]?.medusa_id

      return {
        barcode,
        context,
        variantId:       medusaVariantId,
        sku:             p.default_code ?? barcode,
        odooProductId:   p.id,
        odooProductName: p.name,
        source:          'erp_mapping',
        resolvedAt:      new Date().toISOString(),
      }
    } catch {
      return null
    }
  }

  private _formatFromCache(barcode: string, context: BarcodeContext, entry: BarcodeCacheEntry): ResolvedBarcode {
    return {
      barcode,
      context,
      variantId:       entry.variantId,
      productId:       entry.productId,
      sku:             entry.sku,
      title:           entry.title,
      unitPriceCents:  entry.unitPriceCents,
      odooProductId:   entry.odooProductId,
      imageUrl:        entry.imageUrl,
      source:          'redis_cache',
      resolvedAt:      new Date().toISOString(),
    }
  }
}
