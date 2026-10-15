/**
 * /admin/products/:product_id/variants/:variant_id/extension
 *
 * GET , fetch the extension record for a variant (null if none exists yet)
 * POST, upsert the extension (create on first call, update thereafter)
 */
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { PRODUCT_EXT_MODULE } from '../../../../../../../modules/product-ext/index';
import type { ProductExtService } from '../../../../../../../modules/product-ext/index';
import { upsertVariantExtWorkflow } from '../../../../../../../workflows/upsert-variant-ext';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { variant_id } = req.params as { variant_id: string };
  const service = req.scope.resolve<ProductExtService>(PRODUCT_EXT_MODULE);

  const results = await service.listVariantExtensions({ variant_id });
  res.json({ extension: results[0] ?? null });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { variant_id } = req.params as { variant_id: string };
  const body = req.body as { videos?: any[] };

  const { result: extension } = await upsertVariantExtWorkflow(req.scope).run({
    input: { variant_id, ...body },
  });

  res.json({ extension });
}
