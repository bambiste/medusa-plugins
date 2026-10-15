# @bambiste/medusa-stories

## 0.0.2

### Patch Changes

- e76a0fc: Rebuild + republish the plugins:
  - odoo workers resolve the module service via an `odooSync` alias (they run with
    the module-local container, where the service is registered as
    `odooSyncService`), fixes `AwilixResolutionError: Could not resolve 'odooSync'`.
  - Ship without the stray full-schema migrations a bad `db:generate` had left in the
    build output (they were never in src, so a fresh build drops them).
