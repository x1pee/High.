/** Future boundary only. The desktop app has no network transport or account. */
export type DevicePlatform = "windows" | "ios" | "android";

/** UTF-8 JSON exported by desktop; mobile imports must validate before replacing data. */
export interface JournalTransferV2 {
  schemaVersion: 2;
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  settings: {
    name: string;
    initial: number;
    theme: "dark" | "light" | "system";
    reducedMotion: boolean;
    interpolate: boolean;
    timeZone: string;
    followEvent?: boolean;
    liveChart?: boolean;
    showVolume?: boolean;
    eventAnimation?: boolean;
    eventOrder?: "newest" | "time";
    chartDensity?: 45 | 90 | 180;
    baselineLevel?: 25 | 50 | 75;
    rhythmStrength?: 1 | 4 | 8;
    starter?: { remaining: number; seed: number; at: number };
    coin?: {
      color:
        | "gold"
        | "mint"
        | "blue"
        | "violet"
        | "coral"
        | "silver"
        | "red"
        | "orange"
        | "lime"
        | "cyan"
        | "pink"
        | "white"
        | "teal"
        | "indigo"
        | "copper"
        | `#${string}`;
      symbol:
        | "initials"
        | "diamond"
        | "star"
        | "mountain"
        | "orbit"
        | "bolt"
        | "flame"
        | "crown"
        | "compass"
        | "wave"
        | "sprout"
        | "hex"
        | "prism"
        | "link"
        | "strata"
        | "vector"
        | "nexus"
        | "aperture";
      rim?: "classic" | "solid" | "segments";
      /** At most five Unicode codepoints. Used by the initials symbol. */
      label?: string;
    };
    appearance?: {
      palette: "blue" | "amber" | "green" | "graphite" | "custom";
      chartColors?: "classic" | "theme" | "custom";
      basePalette?: "blue" | "amber" | "green" | "graphite";
      colors?: { accent: string; up: string; down: string; value: string };
    };
  };
  events: Array<
    TransferRecord & {
      time: string;
      order: number;
      text: string;
      /** Input amount: percentage of the preceding value, or fixed points. */
      delta: number;
      unit: "points" | "percent";
      test?: boolean;
    }
  >;
  days: Array<TransferRecord & { title: string; note: string }>;
}
export interface TransferRecord {
  id: string;
  /** Local YYYY-MM-DD; do not shift when importing into another time zone. */
  date: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncEnvelope {
  protocolVersion: 1;
  graphId: string;
  deviceId: string;
  platform?: DevicePlatform;
  baseServerRevision: string | null;
  schemaVersion: 2;
  changedRecords: SyncRecord[];
}
export interface SyncRecord {
  id: string;
  kind: "event" | "day" | "settings";
  baseRecordVersion: string | null;
  updatedAt: string;
  deletedAt: string | null;
  payload: Record<string, unknown>;
}
export interface SyncConflict {
  id: string;
  base: SyncRecord | null;
  local: SyncRecord;
  remote: SyncRecord;
}
export interface SyncTransport {
  pull(
    graphId: string,
    cursor: string | null,
  ): Promise<{
    cursor: string;
    serverRevision: string;
    records: SyncRecord[];
  }>;
  push(envelope: SyncEnvelope): Promise<{
    acceptedIds: string[];
    serverRevision: string;
    conflicts: SyncConflict[];
  }>;
}
