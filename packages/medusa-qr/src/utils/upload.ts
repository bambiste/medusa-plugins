import { createHash } from 'crypto';
import { CreateFileDTO } from '@medusajs/framework/types';
import { CodePayload } from "./generate-code"

export function generateBase64Hash(base64String: string): string {
  const pureBase64 = base64String.replace(/^data:image\/\w+;base64,/, '');
  return createHash('sha256').update(pureBase64).digest('hex');
}

export function getFileName(name: string, type: 'qr' | 'code' | 'ean') {
  if (type === 'qr')   return `qr-${generateBase64Hash(name)}`;
  if (type === 'code') return `code128-${generateBase64Hash(name)}`;
  if (type === 'ean')  return `ean13-${generateBase64Hash(name)}`;
  return name;
}

/** Strip data-URL prefix and return a proper Buffer for Medusa file upload. */
function base64ToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64, 'base64');
}

export function buildFilesUpload(data: CodePayload): CreateFileDTO[] {
  const files: CreateFileDTO[] = [];

  if (data.qr_code) {
    files.push({
      filename: `${getFileName(data.qr_code, 'qr')}.png`,
      mimeType: 'image/png',
      content: base64ToBuffer(data.qr_code) as any,
    });
  }

  if (data.code128) {
    files.push({
      filename: `${getFileName(data.code128, 'code')}.png`,
      mimeType: 'image/png',
      content: base64ToBuffer(data.code128) as any,
    });
  }

  if (data.ean13) {
    files.push({
      filename: `${getFileName(data.ean13, 'ean')}.png`,
      mimeType: 'image/png',
      content: base64ToBuffer(data.ean13) as any,
    });
  }

  return files;
}
