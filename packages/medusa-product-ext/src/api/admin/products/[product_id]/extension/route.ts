/**
 * /admin/products/:product_id/extension
 *
 * GET , fetch the extension record for a product (null if none exists yet)
 * POST, upsert the extension (create on first call, update thereafter)
 *
 * Routes under src/api/admin/ are automatically protected by Medusa's admin
 * authentication middleware, no explicit authenticate() call needed.
 */
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { PRODUCT_EXT_MODULE } from '../../../../../modules/product-ext/index';
import type { ProductExtService } from '../../../../../modules/product-ext/index';
import { upsertProductExtWorkflow } from '../../../../../workflows/upsert-product-ext';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { product_id } = req.params as { product_id: string };
  const service = req.scope.resolve<ProductExtService>(PRODUCT_EXT_MODULE);

  const results = await service.listProductExtensions({ product_id });
  res.json({ extension: results[0] ?? null });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { product_id } = req.params as { product_id: string };
  const body = req.body as { videos?: any[]; tagline?: string | null };

  const { result: extension } = await upsertProductExtWorkflow(req.scope).run({
    input: { product_id, ...body },
  });

  res.json({ extension });
}
