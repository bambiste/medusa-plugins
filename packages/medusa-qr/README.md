<p align="center">
  <a href="https://www.medusajs.com">
    <img alt="Medusa" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg" width="180" />
  </a>
</p>

# @bambiste/medusa-qr

**QR code generation for MedusaJS v2.**

![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)
![Medusa](https://img.shields.io/badge/Medusa-v2-7c3aed)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Registry](https://img.shields.io/badge/registry-npm-cb3837?logo=npm)

---

QR code generation for MedusaJS v2.

## Installation

```bash
pnpm add @bambiste/medusa-qr
```

## Usage

Register the plugin in your `medusa-config.ts`:

```ts
module.exports = defineConfig({
  plugins: [
    {
      resolve: "@bambiste/medusa-qr",
      options: {},
    },
  ],
})
```

See the [Medusa plugins documentation](https://docs.medusajs.com/learn/fundamentals/plugins) for more.

## License

MIT
