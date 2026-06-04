import crypto from "crypto"

const SECRET = process.env.QR_SECRET || "secret"

export function signPayload(data: any) {
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(JSON.stringify(data))
    .digest("hex")

  return { ...data, signature }
}