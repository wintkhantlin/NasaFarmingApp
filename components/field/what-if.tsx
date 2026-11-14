"use client";

import Slider from "@mui/material/Slider";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatusTag } from "@/components/ui/status";
import { isNeutral, NO_SCENARIO, type Scenario } from "@/lib/engine/scenario";

export interface WhatIfRow {
  id: string;
  label: string;
  before: number;
  after: number;
  known: number;
}

/**
 * The sliders and their before → after rows, without a panel of their own.
 * The Compare screen puts the water-supply test and this weather test in one card,
 * so the farmer meets a single "What if?" instead of two sets of controls.
 */
export function WhatIfBody({ scenario, onChange, rows }: { scenario: Scenario; onChange: (s: Scenario) => void; rows: WhatIfRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label id="rain-l" className="flex justify-between text-label text-ink">
          Rain <span className="tabular">{scenario.rainPct > 0 ? "+" : ""}{scenario.rainPct}%</span>
        </label>
        <Slider aria-labelledby="rain-l" min={-30} max={30} step={5} value={scenario.rainPct} marks onChange={(_, v) => onChange({ ...scenario, rainPct: v as number })} />
        <label id="temp-l" className="flex justify-between text-label text-ink">
          Temperature <span className="tabular">{scenario.tempC > 0 ? "+" : ""}{scenario.tempC} °C</span>
        </label>
        <Slider aria-labelledby="temp-l" min={-2} max={3} step={0.5} value={scenario.tempC} onChange={(_, v) => onChange({ ...scenario, tempC: v as number })} />
      </div>
      {isNeutral(scenario) ? (
        <p className="m-0 text-body-sm text-ink-muted">Move a slider to test a wetter, drier or hotter past.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Result of this test">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 text-body text-ink">
              <span>{r.label}</span>
              <span className="tabular">{r.before} → {r.after} of {r.known} seasons with a shortfall or heat</span>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-body-sm text-ink-muted">Rain timing is kept, so a later start to the monsoon is not tested.</p>
    </div>
  );
}

/** S18: an even shift on every past day, with before and after side by side. Always labelled hypothetical. */
export function WhatIf({ scenario, onChange, rows }: { scenario: Scenario; onChange: (s: Scenario) => void; rows: WhatIfRow[] }) {
  return (
    <Panel as="section" aria-labelledby="whatif-title" className="flex flex-col gap-4 p-4 sm:p-5">
      <PanelHeader
        id="whatif-title"
        as="h3"
        title="What if?"
        description="Not a forecast or a climate projection."
        aside={isNeutral(scenario) ? null : <Button variant="quiet" onClick={() => onChange(NO_SCENARIO)}>Reset</Button>}
      />
      <StatusTag tag="hypothetical" className="self-start" />
      <WhatIfBody scenario={scenario} onChange={onChange} rows={rows} />
    </Panel>
  );
}
