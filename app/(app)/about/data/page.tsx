import type { Metadata } from "next";
import { CheckGlyph, ClockGlyph } from "@/components/ui/icons";
import { Disclosure } from "@/components/ui/disclosure";
import { Panel } from "@/components/ui/panel";
import { SourceLine } from "@/components/ui/source-line";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { earthdataConfigured } from "@/lib/nasa/earthdata";

export const metadata: Metadata = { title: "About the data" };

type Status = "Connected adapter" | "Credentials configured; unverified" | "Needs Earthdata login" | "Not connected" | "Proposed";

interface SourceItem {
  name: string;
  gives: string;
  detail: { dataset: string; resolution: string; dates: string };
  status: Status;
  note: string;
}

function getSources(): SourceItem[] {
  const appeearsOk = earthdataConfigured("appeears");
  const imergOk = earthdataConfigured("imerg");

  return [
    {
      name: "Weather",
      gives: "Air temperature (mean, highest, lowest), humidity, wind, sunshine energy, rain and air pressure, daily.",
      detail: { dataset: "NASA POWER daily point API", resolution: "about 0.5° x 0.625°", dates: "2016 to 2025, UTC days" },
      status: "Connected adapter",
      note: "Days are UTC days, not Myanmar local days. A missing value is missing, never zero rain. Rainfall here is the MERRA-2 bias-corrected series until satellite rainfall is connected.",
    },
    {
      name: "Soil properties",
      gives: "Clay, sand, silt, acidity, organic carbon and more, to 30 cm.",
      detail: { dataset: "ISRIC SoilGrids v2 (not NASA)", resolution: "250 m", dates: "modelled map" },
      status: "Connected adapter",
      note: "Some places, such as towns and water, have no value. A soil test you enter always replaces it.",
    },
    {
      name: "Field vegetation",
      gives: "How green the field was on clear days, with cloud, shadow, snow and water removed.",
      detail: { dataset: "USGS Landsat Collection 2 Level-2 via Microsoft Planetary Computer", resolution: "30 m", dates: "available clear days" },
      status: "Connected adapter",
      note: "Surface reflectance, NDVI and NDMI retrieved on demand from Microsoft Planetary Computer COGs. Open access, no Earthdata login required. AppEEARS HLS is a credentials-gated fallback. Result availability depends on valid clear observations.",
    },
    {
      name: "Regional vegetation history (optional)",
      gives: "16-day greenness over 250 m cells, for regional context.",
      detail: { dataset: "MOD13Q1 v061", resolution: "250 m", dates: "16-day composites" },
      status: "Not connected",
      note: "This dataset is listed for future regional context only. There is no active MODIS adapter or result path in the app.",
    },
    {
      name: "Satellite rainfall",
      gives: "Daily rain estimated from satellites, used as the main rainfall once it covers the whole record.",
      detail: { dataset: "GPM IMERG Final daily V07", resolution: "0.1°", dates: "2016 to 2025" },
      status: imergOk ? "Credentials configured; unverified" : "Needs Earthdata login",
      note: imergOk
        ? "Credentials are configured for NASA GES DISC OPeNDAP DAP4. This does not prove successful retrieval; inspect each result's status and coverage."
        : "The search for files works. Reading values needs an Earthdata token (EARTHDATA_TOKEN) on the server. When unconfigured, rainfall safely falls back to NASA POWER PRECTOTCORR.",
    },
    {
      name: "Soil moisture from satellite",
      gives: "How wet the surface and the top metre of soil were, as regional context.",
      detail: { dataset: "SMAP L4 (SPL4SMGP v008)", resolution: "9 km, three-hourly", dates: "through 2025" },
      status: appeearsOk ? "Credentials configured; unverified" : "Needs Earthdata login",
      note: appeearsOk
        ? "Credentials are configured for NASA AppEEARS. Successful retrieval is checked per result. SMAP is 9 km regional context."
        : "A 9 km model value, larger than most fields. Retrieved via NASA AppEEARS, which requires EARTHDATA_USERNAME and EARTHDATA_PASSWORD on the server.",
    },
    {
      name: "Terrain",
      gives: "Ground height, and from it the slope of the field.",
      detail: { dataset: "SRTMGL1", resolution: "about 30 m", dates: "February 2000" },
      status: appeearsOk ? "Credentials configured; unverified" : "Needs Earthdata login",
      note: "Slope needs neighbouring cells, so a single pin has none. This is credentials-gated through NASA AppEEARS and is not assumed available from configuration alone.",
    },
    {
      name: "Surface temperature and water use (optional)",
      gives: "Land-surface temperature and modelled water use on dates the satellite passed over.",
      detail: { dataset: "ECOSTRESS LSTE and JET", resolution: "about 70 m", dates: "available passes" },
      status: "Proposed",
      note: "Only a quality-assurance helper exists; there is no active ECOSTRESS result adapter. Surface temperature is not air temperature, and ET is not a verified field water measurement.",
    },
  ];
}

const STATUS_ICON = {
  "Connected adapter": <CheckGlyph className="text-healthy" />,
  "Credentials configured; unverified": <ClockGlyph className="text-ink-muted" />,
  "Needs Earthdata login": <ClockGlyph className="text-drought" />,
  "Not connected": <ClockGlyph className="text-ink-muted" />,
  Proposed: <ClockGlyph className="text-ink-muted" />,
} satisfies Record<Status, React.ReactNode>;

export default function AboutDataPage() {
  const sources = getSources();
  const connected = sources.filter((s) => s.status === "Connected adapter").length;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink sm:text-display">About the data</h1>
        <p className="max-w-measure text-body text-ink-muted">
          Every figure in this app comes from one of these sources and shows which. Where a source isn&apos;t connected,
          the app says so instead of filling the gap.
        </p>
        <p className="m-0 text-body-sm text-ink-muted">
          {connected} of {sources.length} sources have connected open-access adapters. This catalog describes implementation, not live service health or field validation.
        </p>
      </div>

      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
        {sources.map((s) => (
          <li key={s.name} className="min-w-0">
            <Panel as="article" className="flex h-full flex-col gap-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <h2 className="min-w-0 text-headline text-ink">{s.name}</h2>
                <span
                  className={cn(
                    "inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-label",
                    s.status === "Connected adapter"
                      ? "border-healthy/30 bg-field-soft text-healthy"
                      : "border-line-strong bg-surface text-ink",
                  )}
                >
                  {STATUS_ICON[s.status]}
                  {s.status}
                </span>
              </div>
              <p className="m-0 max-w-measure text-body text-ink">{s.gives}</p>
              <p className="m-0 max-w-measure text-body-sm text-ink-muted">{s.note}</p>
              <SourceLine {...s.detail} className="mt-auto border-t border-line pt-3" />
            </Panel>
          </li>
        ))}
      </ul>

      <p className="m-0 max-w-measure text-body-sm text-ink-muted">{copy.data.rainfallNote}</p>

      <Disclosure title={copy.glossary.title}>
        <div className="pt-1">
          <dl className="m-0 grid gap-4 md:grid-cols-2">
            {copy.glossary.items.map((g) => (
              <Panel as="div" key={g.term} className="flex flex-col gap-1 p-4">
                <dt className="text-label text-ink">{g.term}</dt>
                <dd className="m-0 text-body-sm text-ink-muted">{g.body}</dd>
              </Panel>
            ))}
          </dl>
        </div>
      </Disclosure>

      <Disclosure title={copy.glossary.satelliteVsGround.title}>
        <div className="pt-1">
          <dl className="m-0 grid gap-4 md:grid-cols-2">
            {copy.glossary.satelliteVsGround.items.map((g) => (
              <Panel as="div" key={g.term} className="flex flex-col gap-1 p-4">
                <dt className="text-label text-ink">{g.term}</dt>
                <dd className="m-0 text-body-sm text-ink-muted">{g.body}</dd>
              </Panel>
            ))}
          </dl>
        </div>
      </Disclosure>

      <p className="m-0 max-w-measure text-body-sm text-ink-muted">
        Region boundaries for Ayeyarwady, Magway and Shan State: geoBoundaries gbOpen (2019), CC BY 4.0, simplified. They decide which crop rules apply and are not a legal boundary. Crop values are listed with their sources on the{" "}
        <a href="/about/crops" className="text-field underline">
          crop library page
        </a>
        .
      </p>
    </>
  );
}
