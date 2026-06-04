import { PROVIDER_IDS } from "../constants"
import type { OpenFactsBaseProviderOptions } from "../types"
import { OpenFactsBaseProvider } from "./open-facts-base"

export class OpenBeautyFactsProvider extends OpenFactsBaseProvider {
  protected readonly host = "openbeautyfacts.org"

  constructor(options: OpenFactsBaseProviderOptions = {}) {
    super(PROVIDER_IDS.OPEN_BEAUTY_FACTS, options, 20)
  }
}
