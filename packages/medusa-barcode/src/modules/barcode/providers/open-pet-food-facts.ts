import { PROVIDER_IDS } from "../constants"
import type { OpenFactsBaseProviderOptions } from "../types"
import { OpenFactsBaseProvider } from "./open-facts-base"

export class OpenPetFoodFactsProvider extends OpenFactsBaseProvider {
  protected readonly host = "openpetfoodfacts.org"

  constructor(options: OpenFactsBaseProviderOptions = {}) {
    super(PROVIDER_IDS.OPEN_PET_FOOD_FACTS, options, 30)
  }
}
