import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { PRODUCT_EXT_MODULE } from '../modules/product-ext/index';
import type { ProductExtService } from '../modules/product-ext/index';
import type { VideoItem } from '../modules/product-ext/models/product-extension';

export interface UpsertProductExtInput {
  product_id: string;
  videos?:    VideoItem[];
  tagline?:   string | null;
}

const upsertProductExtStep = createStep(
  'upsert-product-ext-step',
  async (input: UpsertProductExtInput, { container }) => {
    const service = container.resolve<ProductExtService>(PRODUCT_EXT_MODULE);

    const existing = await service.listProductExtensions({ product_id: input.product_id });

    // Cast service to any — MedusaService's generated types use `Record<string, unknown>`
    // for json columns but we store VideoItem[] which is an array, not a plain object.
    const svc = service as any;
    const videos = input.videos ?? [];
    const tagline = input.tagline ?? null;

    let extension: any;
    if (existing.length) {
      [extension] = await svc.updateProductExtensions([
        { id: existing[0].id, videos, tagline },
      ]);
    } else {
      [extension] = await svc.createProductExtensions([
        { product_id: input.product_id, videos, tagline },
      ]);
    }

    return new StepResponse(extension, { id: extension.id, wasNew: !existing.length });
  },

  async (ctx, { container }) => {
    if (!ctx) return;
    // Compensation: delete newly created extension on workflow failure
    if (ctx.wasNew) {
      const service = container.resolve<ProductExtService>(PRODUCT_EXT_MODULE);
      await service.deleteProductExtensions([ctx.id]);
    }
  }
);

export const upsertProductExtWorkflow = createWorkflow(
  'upsert-product-ext',
  (input: UpsertProductExtInput) => {
    const extension = upsertProductExtStep(input);
    return new WorkflowResponse(extension);
  }
);
