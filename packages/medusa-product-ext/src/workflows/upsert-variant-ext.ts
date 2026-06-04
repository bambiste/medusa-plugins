import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { PRODUCT_EXT_MODULE } from '../modules/product-ext/index';
import type { ProductExtService } from '../modules/product-ext/index';
import type { VideoItem } from '../modules/product-ext/models/product-extension';

export interface UpsertVariantExtInput {
  variant_id: string;
  videos?:    VideoItem[];
}

const upsertVariantExtStep = createStep(
  'upsert-variant-ext-step',
  async (input: UpsertVariantExtInput, { container }) => {
    const service = container.resolve<ProductExtService>(PRODUCT_EXT_MODULE);
    const existing = await service.listVariantExtensions({ variant_id: input.variant_id });

    const svc = service as any;
    const videos = input.videos ?? [];

    let extension: any;
    if (existing.length) {
      [extension] = await svc.updateVariantExtensions([{ id: existing[0].id, videos }]);
    } else {
      [extension] = await svc.createVariantExtensions([{ variant_id: input.variant_id, videos }]);
    }

    return new StepResponse(extension, { id: extension.id, wasNew: !existing.length });
  },

  async (ctx, { container }) => {
    if (!ctx) return;
    if (ctx.wasNew) {
      const service = container.resolve<ProductExtService>(PRODUCT_EXT_MODULE);
      await service.deleteVariantExtensions([ctx.id]);
    }
  }
);

export const upsertVariantExtWorkflow = createWorkflow(
  'upsert-variant-ext',
  (input: UpsertVariantExtInput) => {
    const extension = upsertVariantExtStep(input);
    return new WorkflowResponse(extension);
  }
);
