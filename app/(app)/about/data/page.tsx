import type { Metadata } from "next";
import { CheckGlyph, ClockGlyph } from "@/components/ui/icons";
import { Panel } from "@/components/ui/panel";
import { SourceLine } from "@/components/ui/source-line";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";
import { earthdataConfigured } from "@/lib/nasa/earthdata";

export const metadata: Metadata = { title: "About the data" };

type Status = "Working" | "Needs Earthdata login";

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
      status: "Working",
      note: "Days are UTC days, not Myanmar local days. A missing value is missing, never zero rain. Rainfall here is the MERRA-2 bias-corrected series until satellite rainfall is connected.",
    },
    {
      name: "Soil properties",
      gives: "Clay, sand, silt, acidity, organic carbon and more, to 30 cm.",
      detail: { dataset: "ISRIC SoilGrids v2 (not NASA)", resolution: "250 m", dates: "modelled map" },
      status: "Working",
      note: "Some places, such as towns and water, have no value. A soil test you enter always replaces it.",
    },
    {
      name: "Field vegetation",
      gives: "How green the field was on clear days, with cloud, shadow, snow and water removed.",
      detail: { dataset: "USGS Landsat Collection 2 Level-2 via Microsoft Planetary Computer", resolution: "30 m", dates: "available clear days" },
      status: "Working",
      note: "Surface reflectance, NDVI and NDMI retrieved on demand from Microsoft Planetary Computer COGs. Open access, no Earthdata login required. AppEEARS HLS is configured as fallback.",
    },
    {
      name: "Regional vegetation history (optional)",
      gives: "16-day greenness over 250 m cells, for regional context.",
      detail: { dataset: "MOD13Q1 v061 via Microsoft Planetary Computer", resolution: "250 m", dates: "16-day composites" },
      status: "Working",
      note: "16-day composite greenness over 250 m cells from Planetary Computer COGs, for regional context without needing credentials. AppEEARS is configured as fallback.",
    },
    {
      name: "Satellite rainfall",
      gives: "Daily rain estimated from satellites, used as the main rainfall once it covers the whole record.",
      detail: { dataset: "GPM IMERG Final daily V07", resolution: "0.1°", dates: "2016 to 2025" },
      status: imergOk ? "Working" : "Needs Earthdata login",
      note: imergOk
        ? "Reading values via NASA GES DISC OPeNDAP DAP4 with Earthdata token."
        : "The search for files works. Reading values needs an Earthdata token (EARTHDATA_TOKEN) on the server. When unconfigured, rainfall safely falls back to NASA POWER PRECTOTCORR.",
    },
    {
      name: "Soil moisture from satellite",
      gives: "How wet the surface and the top metre of soil were, as regional context.",
      detail: { dataset: "SMAP L4 (SPL4SMGP v008)", resolution: "9 km, three-hourly", dates: "through 2025" },
      status: appeearsOk ? "Working" : "Needs Earthdata login",
      note: appeearsOk
        ? "Retrieving 9 km regional soil moisture from NASA AppEEARS."
        : "A 9 km model value, larger than most fields. Retrieved via NASA AppEEARS, which requires EARTHDATA_USERNAME and EARTHDATA_PASSWORD on the server.",
    },
    {
      name: "Terrain",
      gives: "Ground height, and from it the slope of the field.",
      detail: { dataset: "SRTMGL1", resolution: "about 30 m", dates: "February 2000" },
      status: appeearsOk ? "Working" : "Needs Earthdata login",
      note: appeearsOk
        ? "Ground height and slope retrieved via NASA AppEEARS SRTM."
        : "Slope needs neighbouring cells, so a single pin has none. Retrieved via NASA AppEEARS, which requires EARTHDATA_USERNAME and EARTHDATA_PASSWORD on the server.",
    },
    {
      name: "Surface temperature and water use (optional)",
      gives: "Land-surface temperature and modelled water use on dates the satellite passed over.",
      detail: { dataset: "ECOSTRESS LSTE and JET", resolution: "about 70 m", dates: "available passes" },
      status: appeearsOk ? "Working" : "Needs Earthdata login",
      note: appeearsOk
        ? "Land-surface temperature and modelled ET retrieved via NASA AppEEARS ECOSTRESS."
        : "Surface temperature is not air temperature, and water use is in W/m², not mm. Retrieved via NASA AppEEARS, which requires EARTHDATA_USERNAME and EARTHDATA_PASSWORD on the server.",
    },
  ];
}

const STATUS_ICON = {
  Working: <CheckGlyph className="text-healthy" />,
  "Needs Earthdata login": <ClockGlyph className="text-drought" />,
} satisfies Record<Status, React.ReactNode>;

export default function AboutDataPage() {
  const sources = getSources();
  const working = sources.filter((s) => s.status === "Working").length;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink sm:text-display">About the data</h1>
        <p className="max-w-measure text-body text-ink-muted">
          Every figure in this app comes from one of these sources and shows which. Where a source isn&apos;t connected,
          the app says so instead of filling the gap.
        </p>
        <p className="m-0 text-body-sm text-ink-muted">
          {working} of {sources.length} sources are working now.
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
                    s.status === "Working"
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

      <section aria-labelledby="gloss" className="flex flex-col gap-3">
        <h2 id="gloss" className="text-headline text-ink">
          {copy.glossary.title}
        </h2>
        <dl className="m-0 grid gap-4 md:grid-cols-2">
          {copy.glossary.items.map((g) => (
            <Panel as="div" key={g.term} className="flex flex-col gap-1 p-4">
              <dt className="text-label text-ink">{g.term}</dt>
              <dd className="m-0 text-body-sm text-ink-muted">{g.body}</dd>
            </Panel>
          ))}
        </dl>
      </section>

      <section aria-labelledby="ground" className="flex flex-col gap-3">
        <h2 id="ground" className="text-headline text-ink">
          {copy.glossary.satelliteVsGround.title}
        </h2>
        <dl className="m-0 grid gap-4 md:grid-cols-2">
          {copy.glossary.satelliteVsGround.items.map((g) => (
            <Panel as="div" key={g.term} className="flex flex-col gap-1 p-4">
              <dt className="text-label text-ink">{g.term}</dt>
              <dd className="m-0 text-body-sm text-ink-muted">{g.body}</dd>
            </Panel>
          ))}
        </dl>
      </section>

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
