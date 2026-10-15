import { model } from '@medusajs/framework/utils';

/**
 * One extension record per Medusa variant (1:1 via variant_id).
 * Stores extra attributes that don't exist on Medusa's core variant model.
 */
export const VariantExtension = model.define('variant_extension', {
  id:         model.id().primaryKey(),
  variant_id: model.text().unique(),

  /** Uploaded video items, each has a public S3 URL, original filename, and MIME type. */
  videos: model.json(),
});

export default VariantExtension;
