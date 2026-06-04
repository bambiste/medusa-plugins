import { generateQRImage } from './generate-qr';
import { generateBarcode } from './generate-barcode';
import { generateEAN13Code } from './generate-ean13';
import { signPayload } from './sign-payload';

export interface CodePayload {
  payload: any;
  code: string;       // nanoid — used as Code128 barcode value AND QR URL token
  qr_code?: string;  // QR code image data URL
  code128?: string;  // Code128 image data URL
  ean13?: string;    // EAN-13 image data URL
  ean13_value?: string; // Actual 13-digit EAN-13 number (for barcode scanning lookup)
}

export interface CodePayloadOptions {
  enable_qr?: boolean;
  enable_code128?: boolean;
  enable_ean13?: boolean;
  /** If provided and valid (13 digits), use this EAN-13 value instead of generating a new one. */
  existing_ean13?: string;
}

export async function generateCode<T extends Record<string, any>>(
  data: T,
  options?: CodePayloadOptions
): Promise<CodePayload & T> {
  const {
    enable_qr = true,
    enable_code128 = true,
    enable_ean13 = true,
    existing_ean13,
  } = options ?? {};

  const code = await import('nanoid').then((m) => m.nanoid());
  const payload = signPayload({ ...data, code });

  const result = { code, payload, ...data } as CodePayload & T;

  if (enable_qr) {
    result.qr_code = (await generateQRImage(code)) as string;
  }

  if (enable_code128) {
    result.code128 = (await generateBarcode(code, 'code128')) as string;
  }

  if (enable_ean13) {
    // Use the real-world scanned barcode if it is a valid EAN-13; otherwise generate a new one.
    const ean13Value = (existing_ean13 && /^\d{13}$/.test(existing_ean13))
      ? existing_ean13
      : generateEAN13Code();
    result.ean13_value = ean13Value;
    result.ean13 = (await generateBarcode(ean13Value, 'ean13')) as string;
  }

  return result;
}
