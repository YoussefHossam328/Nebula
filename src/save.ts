import type { BaseConfig } from "./base/config";
import { validateBase } from "./base/config";
import type { BaseSimulation } from "./base/model";
import { SOL_SECONDS } from "./base/config";

/** Local mission save (browser localStorage only; nothing leaves the device). */
export const SAVE_KEY = "nebula.mission.v1";

const SIM_FIELDS = [
  "elapsed",
  "nourishment",
  "crops",
  "battery",
  "oxygen",
  "dose",
  "stress",
  "dust",
  "generator",
  "cleanCount",
  "producedWh",
  "loadWh",
  "chargeLossWh",
  "dischargeLossWh",
  "curtailedWh",
  "unservedWh",
  "cleanedAt",
  "punctures",
  "nextLeakAt",
  "leakedKg",
] as const;

export type MissionSave = {
  version: 1;
  savedAt: number;
  config: BaseConfig;
  sim: Record<(typeof SIM_FIELDS)[number], unknown>;
  balance: Record<string, number>;
  calendar: Record<string, number>;
  forced: "dust" | "cold" | "none";
  forceEnd: number;
  modified: boolean;
  reportAt: number;
  replied: boolean;
  player: { x: number; y: number; z: number };
};

export function captureSave(
  sim: BaseSimulation,
  extra: Omit<MissionSave, "version" | "savedAt" | "config" | "sim">,
): MissionSave {
  const fields = {} as MissionSave["sim"];
  for (const k of SIM_FIELDS) {
    const v = sim[k];
    fields[k] = Array.isArray(v) ? [...v] : v;
  }
  return {
    version: 1,
    savedAt: Date.now(),
    config: { ...sim.config },
    sim: fields,
    ...extra,
  };
}

const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);

export function parseSave(text: string | null): MissionSave | null {
  if (!text) return null;
  try {
    const data = JSON.parse(text) as MissionSave;
    if (data?.version !== 1 || typeof data.sim !== "object") return null;
    data.config = validateBase(data.config);
    for (const k of SIM_FIELDS) {
      const v = data.sim[k];
      // Saves from before oxygen punctures existed.
      if (v === undefined && (k === "punctures" || k === "nextLeakAt" || k === "leakedKg")) {
        data.sim[k] = k === "nextLeakAt" ? -1 : 0;
        continue;
      }
      if (k === "crops") {
        if (!Array.isArray(v) || v.length !== 2 || !v.every(finite)) return null;
      } else if (k === "generator") {
        if (typeof v !== "boolean") return null;
      } else if (!finite(v)) return null;
    }
    const p = data.player;
    if (!p || ![p.x, p.y, p.z].every(finite)) return null;
    if ((data.sim.elapsed as number) >= data.config.sols * SOL_SECONDS)
      return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(sim: BaseSimulation, save: MissionSave) {
  for (const k of SIM_FIELDS) {
    const v = save.sim[k];
    (sim as unknown as Record<string, unknown>)[k] = Array.isArray(v)
      ? [...v]
      : v;
  }
}

export function readSave() {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}
export function writeSave(save: MissionSave) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable */
  }
}
