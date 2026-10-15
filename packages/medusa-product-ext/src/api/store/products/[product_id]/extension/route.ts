/**
 * GET /store/products/:product_id/extension
 *
 * Returns the product-level extension (videos, tagline) and any requested
 * variant extensions in a single round-trip. No authentication required.
 *
 * Query params:
 *   variant_ids, comma-separated variant IDs to include in the response
 *                 (pass all variant IDs of the product for a complete payload)
 */
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { PRODUCT_EXT_MODULE } from '../../../../../modules/product-ext/index';
import type { ProductExtService } from '../../../../../modules/product-ext/index';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { product_id } = req.params as { product_id: string };
  const service = req.scope.resolve<ProductExtService>(PRODUCT_EXT_MODULE);

  const variantIdsParam = (req.query as any).variant_ids as string | undefined;
  const variantIds: string[] = variantIdsParam
    ? variantIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Parallel fetch, product ext + variant exts
  const [productExts, variantExts] = await Promise.all([
    service.listProductExtensions({ product_id }),
    variantIds.length
      ? service.listVariantExtensions({ variant_id: variantIds } as any)
      : Promise.resolve([]),
  ]);

  const productExt = productExts[0] ?? null;

  const variants: Record<string, { videos: any[] }> = {};
  for (const ext of variantExts) {
    variants[ext.variant_id] = { videos: (ext.videos as unknown as any[]) ?? [] };
  }

  res.json({
    product_id,
    videos:   (productExt?.videos as unknown as any[]) ?? [],
    tagline:  productExt?.tagline ?? null,
    variants,
  });
}
