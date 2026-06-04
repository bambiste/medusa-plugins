import { MedusaService } from '@medusajs/framework/utils';
import { ProductExtension } from '../models/product-extension';
import { VariantExtension } from '../models/variant-extension';

class ProductExtService extends MedusaService({ ProductExtension, VariantExtension }) {}

export type ProductExtServiceType = typeof ProductExtService;
export type ProductExtServiceInstance = InstanceType<typeof ProductExtService>;

export default ProductExtService;
