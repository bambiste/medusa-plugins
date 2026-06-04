import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BARCODE_MODULE }     from "../modules/barcode/index.js"
import { parseBarcode }       from "../modules/barcode/utils/barcode-parser.js"
import {
  buildProductMetadata,
  parseWeightGrams,
  parseDimensionMm,
} from "../modules/barcode/utils/normalize-product.js"
import { BARCODE_TYPES }      from "../modules/barcode/constants.js"
import type { BarcodeService } from "../modules/barcode/service.js"
import type {
  CreateFromBarcodeInput,
  NormalizedProduct,
  ParsedBarcode,
} from "../modules/barcode/types.js"

// ─── Step inputs / outputs (fully typed, no any) ─────────────────────────────

interface ValidateBarcodeOutput {
  parsed: ParsedBarcode
}

interface ExistingProductOutput {
  productId:  string | null
  variantId:  string | null
  provider:   string | null
}

interface LookupOutput {
  normalized: NormalizedProduct
  provider:   string
  raw:        Record<string, unknown>
}

interface ThumbnailOutput {
  thumbnailUrl: string | null
}

interface CreatedProductOutput {
  productId:  string
  variantId:  string | null
  title:      string
}

interface BarcodeRelationOutput {
  barcodeProductId: string
  productId:        string
  variantId:        string | null
}

// ─── Step 1: Validate barcode format ─────────────────────────────────────────

const validateBarcodeStep = createStep(
  "validate-barcode-step",
  async (input: { barcode: string }): Promise<StepResponse<ValidateBarcodeOutput>> => {
    const parsed = parseBarcode(input.barcode)
    if (!parsed.isValid) {
      throw new Error(`Invalid barcode "${input.barcode}": ${parsed.error}`)
    }
    return new StepResponse({ parsed })
  }
)

// ─── Step 2: Check for an existing BarcodeProduct record ─────────────────────

const checkExistingBarcodeProductStep = createStep(
  "check-existing-barcode-product-step",
  async (
    input: { barcode: string },
    { container }
  ): Promise<StepResponse<ExistingProductOutput>> => {
    const svc = container.resolve<BarcodeService>(BARCODE_MODULE)
    const existing = await svc.findBarcodeProduct(input.barcode)

    return new StepResponse({
      productId: existing?.product_id ?? null,
      variantId: existing?.variant_id ?? null,
      provider:  existing?.source_provider ?? null,
    })
  }
)

// ─── Step 3: Lookup via providers (with local cache) ─────────────────────────

const lookupBarcodeStep = createStep(
  "lookup-barcode-step",
  async (
    input: { barcode: string; skipCache?: boolean },
    { container }
  ): Promise<StepResponse<LookupOutput>> => {
    const svc    = container.resolve<BarcodeService>(BARCODE_MODULE)
    const result = await svc.lookupBarcode(input.barcode, {
      skipCache: input.skipCache ?? false,
    })

    if (!result.found || !result.product) {
      throw new Error(
        result.error ??
        `No product data found for barcode "${input.barcode}" in any provider`
      )
    }

    return new StepResponse({
      normalized: result.product,
      provider:   result.provider ?? "unknown",
      raw:        result.raw ?? {},
    })
  }
)

// ─── Step 4: Download product thumbnail ──────────────────────────────────────

const downloadThumbnailStep = createStep(
  "download-thumbnail-step",
  async (
    input: { imageUrl: string | undefined }
  ): Promise<StepResponse<ThumbnailOutput>> => {
    if (!input.imageUrl) {
      return new StepResponse({ thumbnailUrl: null })
    }

    // For now, use the URL directly (avoids needing the file module).
    // When FileModule is configured, swap this for a buffer upload.
    return new StepResponse({ thumbnailUrl: input.imageUrl })
  }
)

// ─── Step 5: Create Medusa product + default variant ─────────────────────────

const createMedusaProductStep = createStep(
  "create-medusa-product-step",
  async (
    input: {
      normalized:    NormalizedProduct
      provider:      string
      thumbnailUrl:  string | null
      parsed:        ParsedBarcode
      options:       CreateFromBarcodeInput
    },
    { container }
  ): Promise<StepResponse<CreatedProductOutput, { productId: string }>> => {
    const productModule = container.resolve(Modules.PRODUCT) as {
      createProducts(data: object[]): Promise<Array<{ id: string; variants?: Array<{ id: string }> }>>
    }
    const pricingModule = container.resolve(Modules.PRICING) as {
      createPriceSets(data: Array<{
        prices?: Array<{ currency_code: string; amount: number }>
      }>): Promise<Array<{ id: string }>>
    }
    // Cast through unknown — the Link service's create() signature is compatible at runtime.
    // Using Record<string, unknown> to allow the optional `data` field for join-table attributes.
    const remoteLink = container.resolve(ContainerRegistrationKeys.LINK) as unknown as {
      create(links: Array<Record<string, unknown>>): Promise<unknown>
    }

    const { normalized, provider, thumbnailUrl, parsed, options } = input

    const status: "published" | "draft" = options.publishImmediately ? "published" : "draft"
    const varPrices = (options.prices ?? []).filter(p => p.amount > 0)

    const metadata = buildProductMetadata(normalized, provider)

    const weightGrams = parseWeightGrams(normalized.weight)
    const dimensions  = parseDimensionMm(normalized.metadata?.dimension as string | undefined)

    // Build the barcode-specific fields for the variant
    const barcodeFields =
      parsed.type === BARCODE_TYPES.EAN13
        ? { ean: parsed.normalized, barcode: parsed.normalized }
        : parsed.type === BARCODE_TYPES.UPC_A || parsed.type === BARCODE_TYPES.UPC_E
          ? { upc: parsed.normalized, barcode: parsed.normalized }
          : { barcode: parsed.normalized }

    // Prices are NOT passed to the Product Module — they live in the Pricing
    // Module and must be linked separately via the Remote Link.
    const variantPayload = {
      title:   "Default",
      sku:     parsed.normalized,
      options: { "Default": "Default" },
      ...barcodeFields,
      ...(weightGrams !== null ? { weight: weightGrams } : {}),
      ...(dimensions  !== null ? {
        width:  dimensions.width,
        height: dimensions.height,
        length: dimensions.length,
      } : {}),
    }

    // sales_channels is NOT part of CreateProductDTO — handled separately via Remote Link below
    const productPayload = {
      title:        normalized.title,
      description:  normalized.description ?? "",
      status,
      thumbnail:    thumbnailUrl ?? undefined,
      ...(thumbnailUrl ? { images: [{ url: thumbnailUrl }] } : {}),
      metadata,
      options:      [{ title: "Default", values: ["Default"] }],
      variants:     [variantPayload],
      ...(weightGrams !== null ? { weight: weightGrams } : {}),
      ...(dimensions  !== null ? {
        width:  dimensions.width,
        height: dimensions.height,
        length: dimensions.length,
      } : {}),
      ...(options.categoryIds?.length
        ? { categories: options.categoryIds.map(id => ({ id })) }
        : {}),
      ...(options.collectionId
        ? { collection_id: options.collectionId }
        : {}),
    }

    const [product] = await productModule.createProducts([productPayload])

    if (!product?.id) {
      throw new Error("Product creation returned no ID")
    }

    const variantId = product.variants?.[0]?.id ?? null

    // Wire variant → price set (Pricing Module does not coordinate with Product Module)
    if (varPrices.length > 0 && variantId) {
      const [priceSet] = await pricingModule.createPriceSets([{
        prices: varPrices.map(p => ({
          currency_code: p.currency_code,
          amount:        p.amount,
        })),
      }])

      await remoteLink.create([{
        [Modules.PRODUCT]: { variant_id: variantId },
        [Modules.PRICING]: { price_set_id: priceSet.id },
      }])
    }

    // Wire product → sales channels (not in CreateProductDTO, must use Remote Link)
    if (options.salesChannelIds?.length) {
      await remoteLink.create(
        options.salesChannelIds.map(scId => ({
          [Modules.PRODUCT]:        { product_id: product.id },
          [Modules.SALES_CHANNEL]:  { sales_channel_id: scId },
        }))
      )
    }

    // Create an inventory item and link it to the variant.
    // productModule.createProducts() is the raw module call — unlike the REST API which runs
    // createProductsWorkflow (with createInventoryItemsStep), it never auto-creates inventory.
    if (variantId) {
      try {
        const inventoryModule = container.resolve(Modules.INVENTORY) as {
          createInventoryItems(
            data: Array<{ sku?: string; title?: string }>
          ): Promise<Array<{ id: string }>>
        }
        const [inventoryItem] = await inventoryModule.createInventoryItems([{
          sku:   parsed.normalized,
          title: normalized.title,
        }])
        if (inventoryItem?.id) {
          await remoteLink.create([{
            [Modules.PRODUCT]:   { variant_id: variantId },
            [Modules.INVENTORY]: { inventory_item_id: inventoryItem.id },
            data:                { required_quantity: input.options.requiredQuantity ?? 1 },
          }])
        }
      } catch {
        // Non-fatal — product still created; inventory item can be linked manually later
      }
    }

    return new StepResponse(
      { productId: product.id, variantId, title: normalized.title },
      { productId: product.id }
    )
  },
  // Compensation: delete the product if a later step fails
  async (compensationData, { container }) => {
    const productId = compensationData?.productId
    if (!productId) return
    const productModule = container.resolve(Modules.PRODUCT) as {
      deleteProducts(ids: string[]): Promise<void>
    }
    try {
      await productModule.deleteProducts([productId])
    } catch {
      // Best-effort cleanup
    }
  }
)

// ─── Step 6: Save BarcodeProduct relation ────────────────────────────────────

const saveBarcodeRelationStep = createStep(
  "save-barcode-relation-step",
  async (
    input: {
      barcode:   string
      productId: string
      variantId: string | null
      provider:  string
    },
    { container }
  ): Promise<StepResponse<BarcodeRelationOutput, { barcode: string }>> => {
    const svc = container.resolve<BarcodeService>(BARCODE_MODULE)

    const record = await svc.saveBarcodeProduct({
      barcode:          input.barcode,
      product_id:       input.productId,
      variant_id:       input.variantId ?? undefined,
      source_provider:  input.provider,
      confidence_score: 1.0,
    })

    return new StepResponse(
      {
        barcodeProductId: record.id,
        productId:        input.productId,
        variantId:        input.variantId,
      },
      { barcode: input.barcode }   // compensation payload
    )
  },
  // Compensation: remove the BarcodeProduct record
  async (compensationData, { container }) => {
    const barcode = compensationData?.barcode
    if (!barcode) return
    const svc = container.resolve<BarcodeService>(BARCODE_MODULE)
    try {
      await svc.removeBarcodeProduct(barcode)
    } catch {
      // Best-effort cleanup
    }
  }
)

// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface LookupAndCreateProductInput extends CreateFromBarcodeInput {
  skipCache?: boolean
}

export interface LookupAndCreateProductOutput {
  created:     boolean
  existing:    boolean
  product_id:  string
  variant_id:  string | null
  provider:    string
  title:       string
}

export const lookupAndCreateProductWorkflow = createWorkflow(
  "barcode-lookup-and-create-product",
  (input: LookupAndCreateProductInput): WorkflowResponse<LookupAndCreateProductOutput> => {

    // 1. Validate format
    const { parsed } = validateBarcodeStep({ barcode: input.barcode })

    // 2. Short-circuit if this barcode is already linked to a product
    const existing = checkExistingBarcodeProductStep({ barcode: input.barcode })

    // Note: WorkflowSDK does not support JS if/return inside the workflow fn
    // directly — we handle the "existing" case in the API route instead by
    // calling this workflow only when needed. The step still runs to surface
    // the data early and benefit from transaction safety.

    // 3. Lookup
    const { normalized, provider, raw } = lookupBarcodeStep({
      barcode:   input.barcode,
      skipCache: input.skipCache,
    })

    // 4. Download thumbnail (best-effort)
    const { thumbnailUrl } = downloadThumbnailStep({ imageUrl: normalized.image })

    // 5. Create product
    const { productId, variantId, title } = createMedusaProductStep({
      normalized,
      provider,
      thumbnailUrl,
      parsed,
      options: input,
    })

    // 6. Save relation
    saveBarcodeRelationStep({
      barcode:   input.barcode,
      productId,
      variantId,
      provider,
    })

    return new WorkflowResponse({
      created:    true,
      existing:   false,
      product_id: productId,
      variant_id: variantId,
      provider,
      title,
    })
  }
)
