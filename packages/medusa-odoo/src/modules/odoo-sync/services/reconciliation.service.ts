import type { OdooClient } from '../client/odoo-client.js'

interface ReconciliationResult {
  checked: number
  matched: number
  drifted: number
  fixed: number
  conflicts: number
  errors: number
  details: Array<{
    variantId: string
    odooId: number
    medusaQty: number
    odooQty: number
    delta: number
    action: 'none' | 'fixed_medusa' | 'fixed_odoo' | 'conflict' | 'error'
  }>
}

export class InventoryReconciliationService {
  constructor(
    private odooClient: OdooClient,
    private container: any,
    private options: {
      driftThreshold: number   // absolute qty difference before action taken
      strategy: 'odoo_wins' | 'medusa_wins' | 'log_only'
    },
  ) {}

  async reconcile(variantIds?: string[]): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      checked: 0, matched: 0, drifted: 0, fixed: 0, conflicts: 0, errors: 0, details: [],
    }

    const inventoryModule = this.container.resolve('inventoryModule') as any
    const productModule = this.container.resolve('productModuleService') as any

    // Fetch all variants to reconcile (or a subset)
    const variants = variantIds
      ? await productModule.listVariants({ id: variantIds })
      : await productModule.listVariants({}, { take: 500 })

    for (const variant of variants) {
      try {
        result.checked++
        // Get Medusa inventory level
        const [inventoryItem] = await inventoryModule.listInventoryItems({ variant_id: variant.id })
        if (!inventoryItem) continue

        const [medusaLevel] = await inventoryModule.listInventoryLevels({ inventory_item_id: inventoryItem.id })
        const medusaQty = medusaLevel?.stocked_quantity ?? 0

        // Get Odoo quantity via barcode or default_code
        const sku = variant.sku ?? `MEDUSA-${variant.id}`
        const odooProducts = await this.odooClient.rpc<number[]>(
          'product.product', 'search',
          [[['default_code', '=', sku]]],
        )
        if (!odooProducts.length) continue

        const odooId = odooProducts[0]
        const odooQuants = await this.odooClient.rpc<Array<{ quantity: number }>>(
          'stock.quant', 'search_read',
          [[['product_id', '=', odooId], ['location_id.usage', '=', 'internal']]],
          { fields: ['quantity'] },
        )
        const odooQty = odooQuants.reduce((sum, q) => sum + (q.quantity ?? 0), 0)

        const delta = Math.abs(medusaQty - odooQty)
        const detail: ReconciliationResult['details'][0] = {
          variantId: variant.id, odooId, medusaQty, odooQty, delta, action: 'none',
        }

        if (delta <= this.options.driftThreshold) {
          result.matched++
        } else {
          result.drifted++
          if (this.options.strategy === 'odoo_wins') {
            // Update Medusa inventory level to match Odoo
            await inventoryModule.updateInventoryLevels([{
              id: medusaLevel.id,
              stocked_quantity: odooQty,
            }])
            detail.action = 'fixed_medusa'
            result.fixed++
          } else if (this.options.strategy === 'medusa_wins') {
            // Update Odoo to match Medusa
            await this.odooClient.updateStockQuantity(odooId, 8 /* WH/Stock default */, medusaQty)
            detail.action = 'fixed_odoo'
            result.fixed++
          } else {
            detail.action = 'conflict'
            result.conflicts++
          }
        }
        result.details.push(detail)
      } catch (err: any) {
        result.errors++
        console.error(`[reconciliation] Error for variant ${variant.id}:`, err.message)
      }
    }

    return result
  }
}
