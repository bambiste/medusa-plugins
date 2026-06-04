import { BARCODE_TYPES, type BarcodeTypeValue } from "../constants"
import type { ParsedBarcode } from "../types"

// ─── Checksum helpers ─────────────────────────────────────────────────────────

/**
 * GS1 checksum validation (shared by EAN-13 and UPC-A).
 *
 * Algorithm: sum of (digit × weight) where weights alternate 1, 3
 * starting from the LEFT; the total must be divisible by 10.
 */
function validateGS1Checksum(digits: string): boolean {
  const d = digits.split("").map(Number)
  const len = d.length
  let sum = 0
  for (let i = 0; i < len; i++) {
    sum += d[i] * (i % 2 === 0 ? 1 : 3)
  }
  return sum % 10 === 0
}

/** Expand UPC-E (8 digit) to its full UPC-A (12 digit) equivalent. */
function expandUpcE(upce: string): string {
  const s = upce.startsWith("0") ? upce.slice(1, 7) : upce.slice(1, 7)
  const manufacturer = s.slice(0, 6)
  const check = upce.at(-1) ?? "0"
  const lastDigit = parseInt(manufacturer.at(-1) ?? "0", 10)

  let full: string
  switch (lastDigit) {
    case 0:
    case 1:
    case 2:
      full = `${manufacturer.slice(0, 2)}${lastDigit}0000${manufacturer.slice(2, 5)}`
      break
    case 3:
      full = `${manufacturer.slice(0, 3)}00000${manufacturer.slice(3, 5)}`
      break
    case 4:
      full = `${manufacturer.slice(0, 4)}00000${manufacturer.slice(4, 5)}`
      break
    default:
      full = `${manufacturer.slice(0, 5)}0000${lastDigit}`
  }
  return `0${full}${check}`
}

// ─── Type detection ───────────────────────────────────────────────────────────

function detectType(raw: string): BarcodeTypeValue {
  const trimmed = raw.trim()

  // EAN-13: exactly 13 digits
  if (/^\d{13}$/.test(trimmed))  return BARCODE_TYPES.EAN13

  // UPC-A: exactly 12 digits
  if (/^\d{12}$/.test(trimmed))  return BARCODE_TYPES.UPC_A

  // UPC-E: 8 digits (first digit 0 or 1)
  if (/^[01]\d{7}$/.test(trimmed)) return BARCODE_TYPES.UPC_E

  // QR payload: starts with http/https, or is a URL-like string > 20 chars
  if (/^https?:\/\//i.test(trimmed) || trimmed.length > 20) return BARCODE_TYPES.QR

  // DataMatrix: hexadecimal blocks or specific patterns
  if (/^[A-F0-9]{20,}$/i.test(trimmed)) return BARCODE_TYPES.DATAMATRIX

  // Code128: alphanumeric / mixed — everything else
  return BARCODE_TYPES.CODE128
}

// ─── Normalisation ────────────────────────────────────────────────────────────

function normalise(raw: string, type: BarcodeTypeValue): string {
  const trimmed = raw.trim()
  switch (type) {
    case BARCODE_TYPES.EAN13:
    case BARCODE_TYPES.UPC_A:
    case BARCODE_TYPES.UPC_E:
      return trimmed.replace(/\D/g, "")
    default:
      return trimmed
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(
  normalized: string,
  type: BarcodeTypeValue
): { isValid: boolean; checkDigitValid?: boolean; error?: string } {
  switch (type) {
    case BARCODE_TYPES.EAN13: {
      if (normalized.length !== 13) {
        return { isValid: false, error: "EAN-13 must be exactly 13 digits" }
      }
      const ok = validateGS1Checksum(normalized)
      return { isValid: ok, checkDigitValid: ok, error: ok ? undefined : "EAN-13 checksum invalid" }
    }

    case BARCODE_TYPES.UPC_A: {
      if (normalized.length !== 12) {
        return { isValid: false, error: "UPC-A must be exactly 12 digits" }
      }
      // Pad to 13 digits by prepending '0' and run EAN-13 checksum
      const ok = validateGS1Checksum("0" + normalized)
      return { isValid: ok, checkDigitValid: ok, error: ok ? undefined : "UPC-A checksum invalid" }
    }

    case BARCODE_TYPES.UPC_E: {
      if (normalized.length !== 8) {
        return { isValid: false, error: "UPC-E must be exactly 8 digits" }
      }
      // Expand to UPC-A then validate
      const expanded = expandUpcE(normalized)
      const ok = validateGS1Checksum("0" + expanded)
      return { isValid: ok, checkDigitValid: ok, error: ok ? undefined : "UPC-E checksum invalid" }
    }

    case BARCODE_TYPES.CODE128:
      // Code128 is variable-length; we accept anything ≥ 1 char
      return { isValid: normalized.length >= 1 }

    case BARCODE_TYPES.QR:
    case BARCODE_TYPES.DATAMATRIX:
      return { isValid: normalized.length >= 1 }

    default:
      return { isValid: false, error: "Unrecognised barcode type" }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse and validate a raw barcode string.
 *
 * @example
 * const parsed = parseBarcode("3017620422003")
 * // { raw: "3017620422003", type: "ean13", normalized: "3017620422003", isValid: true, checkDigitValid: true }
 */
export function parseBarcode(raw: string): ParsedBarcode {
  if (!raw || typeof raw !== "string") {
    return { raw: raw ?? "", normalized: "", type: BARCODE_TYPES.UNKNOWN, isValid: false, error: "Empty barcode" }
  }

  const type       = detectType(raw.trim())
  const normalized = normalise(raw, type)
  const { isValid, checkDigitValid, error } = validate(normalized, type)

  return { raw, normalized, type, isValid, checkDigitValid, error }
}

/** Convert a 12-digit UPC-A to 13-digit EAN-13 by prepending "0". */
export function upcToEan13(upc: string): string {
  return "0" + upc.padStart(12, "0")
}

/**
 * Compute the GS1 check digit for a 12-digit base (produces EAN-13).
 * Useful when you have a 12-digit code and need to reconstruct the full EAN-13.
 */
export function computeEan13CheckDigit(first12: string): string {
  const digits = first12.split("").map(Number)
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3)
  }
  return String((10 - (sum % 10)) % 10)
}
