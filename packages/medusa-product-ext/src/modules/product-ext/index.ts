import { Module } from '@medusajs/framework/utils';
import ProductExtService from './services/product-ext-service';

export const PRODUCT_EXT_MODULE = 'ProductExt';

export default Module(PRODUCT_EXT_MODULE, {
  service: ProductExtService,
});

export type { ProductExtServiceInstance as ProductExtService } from './services/product-ext-service';
export type { VideoItem } from './models/product-extension';
export { VariantExtension } from './models/variant-extension';
