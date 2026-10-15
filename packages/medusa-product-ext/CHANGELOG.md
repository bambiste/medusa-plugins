# @bambiste/medusa-product-ext

## 0.0.3

### Patch Changes

- 48b9be1: The README install sections now reference the npm registry instead of GitHub Packages and omit the .npmrc step, and the medusa-barcode README shows the scoped package name for installation and imports along with a feature list.

## 0.0.2

### Patch Changes

- e76a0fc: Rebuild + republish the plugins:
  - odoo workers resolve the module service via an `odooSync` alias (they run with
    the module-local container, where the service is registered as
    `odooSyncService`), fixes `AwilixResolutionError: Could not resolve 'odooSync'`.
  - Ship without the stray full-schema migrations a bad `db:generate` had left in the
    build output (they were never in src, so a fresh build drops them).
