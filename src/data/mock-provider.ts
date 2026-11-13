import fixture from "./scenario.json";
import { validateScenario } from "../resources/config";
import type { Provider } from "./types";
export const mockProvider: Provider = {
  async load() {
    return {
      scenario: validateScenario(fixture),
      source: {
        kind: "simulated",
        provider: "Nebula training fixture",
        datasetId: fixture.id,
        attribution: "Simulated training data — not live NASA measurements.",
        url: null,
        observedAt: null,
        retrievedAt: null,
      },
    };
  },
};
