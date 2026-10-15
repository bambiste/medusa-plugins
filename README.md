<p align="center">
  <a href="https://www.medusajs.com">
    <img alt="Medusa" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg" width="200" />
  </a>
</p>

# Medusa Plugins

**A monorepo of plugins for [MedusaJS v2](https://medusajs.com), published to npm under the `@bambiste` scope.**

![License: MIT](https://img.shields.io/badge/License-MIT-22c55e.svg)
![Medusa](https://img.shields.io/badge/Medusa-v2-7c3aed)
![Monorepo](https://img.shields.io/badge/monorepo-Nx%20%2B%20pnpm-blue)
![Registry](https://img.shields.io/badge/registry-npm-cb3837?logo=npm)

---

## Packages

| Package | Description |
|---|---|
| [`@bambiste/medusa-barcode`](./packages/medusa-barcode) | Barcode scanning, multi-provider lookup and automatic product creation |
| [`@bambiste/medusa-odoo`](./packages/medusa-odoo) | Bidirectional Odoo ERP and Medusa integration |
| [`@bambiste/medusa-product-ext`](./packages/medusa-product-ext) | Product extensions, extra fields and media (videos) |
| [`@bambiste/medusa-qr`](./packages/medusa-qr) | QR code generation |
| [`@bambiste/medusa-social-commerce`](./packages/medusa-social-commerce) | TikTok social commerce + live selling |
| [`@bambiste/medusa-stories`](./packages/medusa-stories) | Story / social feed |

## Installing a plugin

Install and register the plugin in `medusa-config.ts`:

```bash
pnpm add @bambiste/medusa-qr
```

```ts
module.exports = defineConfig({
  plugins: [{ resolve: "@bambiste/medusa-qr", options: {} }],
})
```

## Development

```bash
pnpm install          # install all workspace deps
pnpm build            # build every plugin (medusa plugin:build)
pnpm typecheck        # typecheck affected
```

## Releasing

Releases use [Changesets](https://github.com/changesets/changesets) with a PR-based flow (each plugin versions independently):

```bash
pnpm changeset        # record what changed (select the affected plugins)
git push              # CI opens a "Version Packages" PR
# merge that PR → CI builds and publishes to npm
```

## License

MIT
