export interface Scenario {
  version: 1;
  id: string;
  name: string;
  duration: number;
  batteryCapacity: number;
  oxygenCapacity: number;
  battery: number;
  oxygen: number;
  backgroundDrain: number;
  oxygenConsumption: number;
  generatorDrain: number;
  oxygenProduction: number;
  warning: number;
  critical: number;
}
export interface Source {
  kind: "simulated" | "archived" | "live";
  provider: string;
  datasetId: string;
  attribution: string;
  url: string | null;
  observedAt: string | null;
  retrievedAt: string | null;
}
export interface Provider {
  load(): Promise<{ scenario: Scenario; source: Source }>;
}
