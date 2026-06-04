import { model } from '@medusajs/framework/utils';

/**
 * One extension record per Medusa product (1:1 via product_id).
 * Stores extra attributes that don't exist on Medusa's core product model.
 */
export const ProductExtension = model.define('product_extension', {
  id:         model.id().primaryKey(),
  product_id: model.text().unique(),

  /** Uploaded video items — each has a public S3 URL, original filename, and MIME type. */
  videos: model.json(),

  /** Optional short promotional text shown below the product title. */
  tagline: model.text().nullable(),
});

export default ProductExtension;

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface VideoItem {
  url:      string;
  name:     string;
  mimeType: string;
  size?:    number;
}
