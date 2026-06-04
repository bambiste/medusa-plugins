import { PROVIDER_IDS } from "../constants"
import type { OpenFactsBaseProviderOptions } from "../types"
import { OpenFactsBaseProvider } from "./open-facts-base"

export class OpenProductsFactsProvider extends OpenFactsBaseProvider {
  protected readonly host = "openproductsfacts.org"

  constructor(options: OpenFactsBaseProviderOptions = {}) {
    super(PROVIDER_IDS.OPEN_PRODUCTS_FACTS, options, 40)
  }
}
