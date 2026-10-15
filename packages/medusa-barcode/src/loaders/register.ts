import { BARCODE_MODULE } from "../modules/barcode/index.js"
import type { BarcodeService } from "../modules/barcode/service.js"

interface LoaderContext {
  container: {
    resolve<T>(token: string): T
  }
}

/**
 * Startup loader hook.
 *
 * Runs after Medusa has fully booted.  Logs the registered providers and
 * bootstraps any runtime setup the barcode module needs.
 */
export default async function barcodeModuleLoader({ container }: LoaderContext) {
  try {
    const svc = container.resolve<BarcodeService>(BARCODE_MODULE)

    const providers = svc["providerRegistry"]?.getAll?.() ?? []
    const enabledIds = svc["providerRegistry"]?.getEnabled?.()?.map((p: { providerId: string }) => p.providerId) ?? []

    console.info(
      `[medusa-barcode] Module loaded. ` +
      `Providers: ${providers.map((p: { providerId: string }) => p.providerId).join(", ") || "none"}. ` +
      `Enabled: ${enabledIds.join(", ") || "none"}.`
    )

    // Prune stale cache entries on cold start (best-effort)
    try {
      const purged = await svc.purgeExpiredCache()
      if (purged > 0) {
        console.info(`[medusa-barcode] Purged ${purged} expired cache entries on startup.`)
      }
    } catch {
      // Non-fatal, DB might not be migrated yet on first run
    }
  } catch {
    // Module not registered, skip
  }
}
