---
"@bambiste/medusa-odoo": patch
"@bambiste/medusa-qr": patch
"@bambiste/medusa-product-ext": patch
"@bambiste/medusa-social-commerce": patch
"@bambiste/medusa-stories": patch
"@bambiste/medusa-barcode": patch
---

Rebuild + republish the plugins:

- odoo workers resolve the module service via an `odooSync` alias (they run with
  the module-local container, where the service is registered as
  `odooSyncService`) — fixes `AwilixResolutionError: Could not resolve 'odooSync'`.
- Ship without the stray full-schema migrations a bad `db:generate` had left in the
  build output (they were never in src, so a fresh build drops them).
