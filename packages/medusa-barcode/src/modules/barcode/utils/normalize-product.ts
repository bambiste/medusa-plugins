import type { NormalizedProduct } from "../types"

// ─── String cleaning helpers ──────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function toTitleCase(s: string): string {
  return s.split(/\s+/).map(capitalize).join(" ")
}

function cleanText(s: string | undefined, maxLen = 500): string | undefined {
  if (!s) return undefined
  const clean = s.replace(/\s+/g, " ").trim()
  return clean.length > maxLen ? clean.slice(0, maxLen) + "…" : clean
}

// ─── Category slug normalisation ──────────────────────────────────────────────

const CATEGORY_ALIASES: Record<string, string> = {
  "food":              "Food & Beverages",
  "beverage":         "Food & Beverages",
  "beverages":        "Food & Beverages",
  "drink":            "Food & Beverages",
  "electronics":      "Electronics",
  "electronic":       "Electronics",
  "health":           "Health & Beauty",
  "beauty":           "Health & Beauty",
  "personal care":    "Health & Beauty",
  "cleaning":         "Home & Garden",
  "home":             "Home & Garden",
  "garden":           "Home & Garden",
  "clothing":         "Apparel",
  "apparel":          "Apparel",
  "fashion":          "Apparel",
  "toys":             "Toys & Games",
  "games":            "Toys & Games",
  "sports":           "Sports & Outdoors",
  "outdoors":         "Sports & Outdoors",
  "automotive":       "Automotive",
  "office":           "Office Supplies",
  "pet":              "Pet Supplies",
  "grocery":          "Food & Beverages",
}

export function normalizeCategory(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const lower = raw.toLowerCase().trim()
  for (const [key, value] of Object.entries(CATEGORY_ALIASES)) {
    if (lower.includes(key)) return value
  }
  return toTitleCase(raw)
}

// ─── Physical attribute parsers ──────────────────────────────────────────────

/**
 * Parse a human-readable weight/volume string to grams (integer).
 * Returns null if the string cannot be parsed.
 * Examples: "400g" → 400 | "1.5 kg" → 1500 | "500ml" → 500 | "16 oz" → 454
 */
export function parseWeightGrams(raw: string | undefined): number | null {
  if (!raw) return null
  const m = raw.toLowerCase().trim().match(/^([\d.,]+)\s*(kg|mg|g|lbs?|fl\.?\s*oz|oz|cl|ml|l)\b/)
  if (!m) return null
  const value = parseFloat(m[1].replace(",", "."))
  if (isNaN(value)) return null
  switch (m[2].replace(/\s+/g, "")) {
    case "kg":    return Math.round(value * 1_000)
    case "mg":    return Math.round(value / 1_000)
    case "g":     return Math.round(value)
    case "lb":
    case "lbs":   return Math.round(value * 453.592)
    case "oz":    return Math.round(value * 28.3495)
    case "floz":
    case "fl.oz": return Math.round(value * 29.5735)
    case "l":     return Math.round(value * 1_000)
    case "cl":    return Math.round(value * 10)
    case "ml":    return Math.round(value)   // 1 ml ≈ 1 g
    default:      return null
  }
}

/**
 * Parse a dimension string like "2.5 x 8.5 x 4 inches" → { width, height, length } in mm.
 * Returns null when the format is unrecognised.
 */
export function parseDimensionMm(
  raw: string | undefined
): { width: number; height: number; length: number } | null {
  if (!raw) return null
  const m = raw.match(/([\d.]+)\s*[xX×]\s*([\d.]+)\s*[xX×]\s*([\d.]+)\s*(in(?:ches?)?|cm|mm|m)?/i)
  if (!m) return null
  const nums = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]
  if (nums.some(isNaN)) return null
  const unit = (m[4] ?? "mm").toLowerCase().trim()
  const toMm = (v: number): number => {
    if (unit.startsWith("in")) return Math.round(v * 25.4)
    if (unit === "cm") return Math.round(v * 10)
    if (unit === "m")  return Math.round(v * 1_000)
    return Math.round(v) // mm
  }
  return { width: toMm(nums[0]), height: toMm(nums[1]), length: toMm(nums[2]) }
}

// ─── Metadata value sanitisation ─────────────────────────────────────────────

/**
 * Flatten a metadata value to a type Medusa can store without surprises.
 * Objects → JSON string (capped at 2 KB), arrays → comma-joined or JSON string,
 * everything else → its primitive value.
 */
function sanitizeMetaValue(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v
  if (Array.isArray(v)) {
    const flat = v.map((item) =>
      typeof item === "object" && item !== null ? JSON.stringify(item) : String(item)
    ).join(", ")
    return flat.length > 2_048 ? flat.slice(0, 2_048) + "…" : flat
  }
  // Plain object
  const json = JSON.stringify(v)
  return json.length > 2_048 ? json.slice(0, 2_048) + "…" : json
}

// ─── Deep merge metadata ──────────────────────────────────────────────────────

export function mergeMetadata(
  base: Record<string, unknown> | undefined,
  extra: Record<string, unknown>
): Record<string, unknown> {
  return { ...(base ?? {}), ...extra }
}

// ─── Deduplicate + merge from multiple providers ──────────────────────────────

/**
 * Merge several NormalizedProduct candidates (from different providers) into
 * one best-effort record.  Earlier entries win for non-empty string fields.
 */
export function mergeNormalized(candidates: NormalizedProduct[]): NormalizedProduct | null {
  if (!candidates.length) return null

  const base = candidates[0]
  const result: NormalizedProduct = { ...base }

  for (const c of candidates.slice(1)) {
    if (!result.description && c.description) result.description = c.description
    if (!result.brand       && c.brand)       result.brand       = c.brand
    if (!result.category    && c.category)    result.category    = c.category
    if (!result.image       && c.image)       result.image       = c.image
    if (!result.weight      && c.weight)      result.weight      = c.weight
    if (c.metadata) {
      result.metadata = mergeMetadata(result.metadata, c.metadata)
    }
  }

  return sanitizeNormalized(result)
}

// ─── Final sanitization ───────────────────────────────────────────────────────

/**
 * Enforce max-lengths, strip unsafe whitespace and normalise category names.
 * Call before saving to DB or passing to Medusa product creation.
 */
export function sanitizeNormalized(p: NormalizedProduct): NormalizedProduct {
  return {
    title:       cleanText(p.title, 250) ?? `Product ${p.barcode}`,
    description: cleanText(p.description, 2000),
    barcode:     p.barcode.trim(),
    brand:       cleanText(p.brand, 150),
    category:    normalizeCategory(p.category),
    image:       p.image?.trim(),
    weight:      cleanText(p.weight, 60),
    metadata:    p.metadata,
  }
}

/** Build the metadata object to attach to the Medusa product. */
export function buildProductMetadata(
  normalized: NormalizedProduct,
  provider: string
): Record<string, string | number | boolean | null> {
  const base: Record<string, string | number | boolean | null> = {
    barcode:          normalized.barcode,
    barcode_brand:    normalized.brand    ?? null,
    barcode_category: normalized.category ?? null,
    barcode_weight:   normalized.weight   ?? null,
    source_provider:  provider,
  }

  // Sanitize every provider-specific metadata value so nothing becomes [object Object]
  for (const [key, value] of Object.entries(normalized.metadata ?? {})) {
    base[key] = sanitizeMetaValue(value)
  }

  // Remove null entries to keep the metadata object tidy
  for (const key of Object.keys(base)) {
    if (base[key] === null) delete base[key]
  }

  return base
}
