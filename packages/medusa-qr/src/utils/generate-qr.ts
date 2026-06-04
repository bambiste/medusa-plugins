import QRCode from "qrcode"

export async function generateQRImage(code: string) {
  const adminUrl = (process.env.ADMIN_URL ?? 'http://localhost:3004').replace(/\/$/, '')
  return await QRCode.toDataURL(`${adminUrl}/scan/${code}`)
}