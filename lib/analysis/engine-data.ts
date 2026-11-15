import { checkRegion } from "../data/regions";
import { toDailyRecords } from "../engine/climate";
import type { EngineData, RemoteInfo, SourceStatus } from "../engine/data";
import { effectiveSoil } from "../engine/soil-input";
import type { Field } from "../types";
import type { ConditionsData, RemoteData } from "../store/data-cache";
import type { RemoteState } from "../server/remote-sensing";

const info = (s: RemoteState<unknown> | undefined): RemoteInfo => ({
  status: (s?.status ?? "not-requested") as SourceStatus,
  provider: s?.provider ?? null,
  retrievedAt: s?.retrievedAt ?? null,
  start: s?.start ?? null,
  end: s?.end ?? null,
});

/**
 * Builds the engine's input from what the browser has: the saved field, the conditions payload and
 * the AppEEARS results. Every source that is absent becomes a status, never a guess.
 */
export function buildEngineData(field: Field, conditions: ConditionsData | null, remote: RemoteData | null): EngineData {
  const weather = conditions?.weather ?? null;
  const region = field.region && field.region !== "unsupported" ? field.region : checkRegion(field.geometry, field.centroid).region;
  const imerg = conditions?.imerg;
  return {
    field,
    region,
    latitude: field.centroid[1],
    elevationM: weather?.elevationM ?? 0,
    records: weather ? toDailyRecords(weather) : [],
    power:
      conditions?.power ?? {
        status: "unavailable",
        version: null,
        fillValue: -999,
        timeStandard: null,
        sources: [],
        retrievedAt: null,
        start: null,
        end: null,
        elevationM: null,
        units: {},
      },
    imerg: imerg?.days ?? [],
    imergInfo: {
      status: imerg?.status ?? "not-requested",
      granules: imerg?.granules ?? 0,
      partialDays: imerg?.partialDays ?? 0,
      retrievedAt: conditions?.fetchedAt ?? null,
      start: imerg?.days[0]?.date ?? null,
      end: imerg?.days[imerg.days.length - 1]?.date ?? null,
    },
    smap: remote?.smap.data?.days ?? [],
    smapInfo: info(remote?.smap),
    hls: remote?.hls.data?.observations ?? [],
    hlsInfo: info(remote?.hls),
    slope: remote?.srtm.data?.slope ?? null,
    srtmInfo: info(remote?.srtm),
    modis: remote?.modis.data?.observations ?? [],
    modisInfo: info(remote?.modis),
    ecostressLst: remote?.ecostressLst.data?.observations ?? [],
    ecostressLstInfo: info(remote?.ecostressLst),
    ecostressEt: remote?.ecostressEt.data?.observations ?? [],
    ecostressEtInfo: info(remote?.ecostressEt),
    soil: effectiveSoil(field, conditions?.soil ?? null),
  };
}
