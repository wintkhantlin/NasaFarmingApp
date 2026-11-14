import type { Metadata } from "next";
import { CheckGlyph, ClockGlyph, CrossGlyph } from "@/components/ui/icons";
import { Panel } from "@/components/ui/panel";
import { SourceLine } from "@/components/ui/source-line";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy/en";

export const metadata: Metadata = { title: "About the data" };

type Status = "Working" | "Not checked live" | "Not connected";

const SOURCES: Array<{
  name: string;
  gives: string;
  detail: { dataset: string; resolution: string; dates: string };
  status: Status;
  note: string;
}> = [
  {
    name: "Weather and soil wetness",
    gives: "Temperature, rain, sunshine, wind, humidity and root-zone wetness, daily.",
    detail: { dataset: "NASA POWER", resolution: "about 0.5°", dates: "1981 to today" },
    status: "Working",
    note: "Rainfall here is the MERRA-2 bias-corrected series, not satellite rainfall.",
  },
  {
    name: "Soil properties",
    gives: "Clay, sand, silt, acidity, organic carbon and more, to 30 cm.",
    detail: { dataset: "ISRIC SoilGrids v2 (not NASA)", resolution: "250 m", dates: "modelled map" },
    status: "Working",
    note: "Some places, such as towns and water, have no value. Enter a soil test if you have one.",
  },
  {
    name: "Soil moisture from satellite",
    gives: "How wet the ground was in each past season.",
    detail: { dataset: "NASA SMAP", resolution: "9 km", dates: "2015 to today" },
    status: "Not checked live",
    note: "Needs a NASA Earthdata login. A 9 km pixel is larger than most fields.",
  },
  {
    name: "Crop greenness",
    gives: "When crops grew on and around your field in past years.",
    detail: { dataset: "MODIS vegetation index", resolution: "250 m", dates: "2000 to today" },
    status: "Not checked live",
    note: "Needs a NASA Earthdata login.",
  },
  {
    name: "Satellite rainfall",
    gives: "Rain measured from space.",
    detail: { dataset: "GPM IMERG", resolution: "0.1°", dates: "2000 to today" },
    status: "Not connected",
    note: "NASA retired the simple point service this app planned to use. It will return once access is set up.",
  },
];

const STATUS_ICON = {
  Working: <CheckGlyph className="text-healthy" />,
  "Not checked live": <ClockGlyph className="text-drought" />,
  "Not connected": <CrossGlyph className="text-ink-muted" />,
} satisfies Record<Status, React.ReactNode>;

export default function AboutDataPage() {
  const working = SOURCES.filter((s) => s.status === "Working").length;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink sm:text-display">About the data</h1>
        <p className="max-w-measure text-body text-ink-muted">
          Every figure in this app comes from one of these sources and shows which. Where a source isn&apos;t connected,
          the app says so instead of filling the gap.
        </p>
        <p className="m-0 text-body-sm text-ink-muted">
          {working} of {SOURCES.length} sources are working now.
        </p>
      </div>

      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
        {SOURCES.map((s) => (
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
    </>
  );
}
