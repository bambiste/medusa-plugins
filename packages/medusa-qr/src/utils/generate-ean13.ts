export function generateEAN13Code() {
  const base = Math.floor(100000000000 + Math.random() * 900000000000).toString()

  const checksum = calculateEAN13Checksum(base)

  return base + checksum
}

function calculateEAN13Checksum(code: string) {
  let sum = 0

  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3)
  }

  return (10 - (sum % 10)) % 10
}