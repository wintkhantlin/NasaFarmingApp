"use client";

// A faux Compare screen for the first-run home. One thing happens: the cursor
// picks Option 1 and the answer under the table changes to match. The still
// (reduced motion, thumbnails) is that payoff. Built from the Stageshow kit in
// ./kit, in the app's own Field Almanac tokens (see preview.css).
import { Badge, Segmented, Stage, Swap, Text, Window, type Act } from "./kit";
import "./preview.css";

type S = { sel: 0 | 1 | 2 };

const OPTIONS = [
  { name: "Your rotation", crops: "Maize, then maize", resilience: "Low", tone: "warning" as const },
  { name: "Option 1", crops: "Sorghum, groundnut, cowpea", resilience: "High", tone: "success" as const },
  { name: "Option 2", crops: "Maize, clover, soybean", resilience: "Medium", tone: "neutral" as const },
];

const ANSWERS = [
  { headline: "Your rotation as recorded", label: "Compared with two other options" },
  { headline: "Switch to sorghum, groundnut and cowpea", label: "Most reliable in dry years" },
  { headline: "Rotate maize with clover and soybean", label: "Biggest soil benefit" },
];

async function script(a: Act<S>) {
  await a.wait(900);
  await a.move("opt-1");
  await a.click();
  a.set({ sel: 1 });
  await a.wait(3600);
}

function Answer({ sel }: { sel: number }) {
  return (
    <div className="rp-answer">
      <Text className="rp-answer__ctx">{sel === 0 ? "Where you are now" : `Option ${sel}`}</Text>
      <Swap id={sel} className="rp-answer__head">
        {ANSWERS[sel].headline}
      </Swap>
      <div className="rp-answer__chips">
        <Badge tone={sel === 0 ? "neutral" : "success"}>
          <Swap id={sel}>{ANSWERS[sel].label}</Swap>
        </Badge>
      </div>
    </div>
  );
}

export function RotationPreview() {
  return (
    <div className="rp-host" data-ss-fill>
      <Stage<S>
        width={620}
        height={400}
        compact={{ below: 500, width: 358, height: 400 }}
        initial={{ sel: 0 }}
        poster={{ sel: 1 }}
        script={script}
        play="once"
        cursor={{ at: { wide: { x: 470, y: 300 }, compact: { x: 280, y: 300 } }, style: "arrow", ripple: true }}
        className="rp"
      >
        {(s, _rect, layout) =>
          layout === "wide" ? (
            <Window title="Highland plot" className="rp-win" body={{ className: "rp-body" }}>
              <Text className="rp-title">Compare rotations</Text>
              <div className="rp-cols">
                {OPTIONS.map((o, i) => (
                  <div
                    key={o.name}
                    className="rp-col"
                    data-on={s.sel === i || undefined}
                    data-target={`opt-${i}`}
                    data-cursor="pointer"
                  >
                    <Text className="rp-col__name">{o.name}</Text>
                    <Text className="rp-col__crops" wrap>
                      {o.crops}
                    </Text>
                    <div className="rp-col__row">
                      <Text className="rp-col__label">Drought resilience</Text>
                      <Badge tone={o.tone}>{o.resilience}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Answer sel={s.sel} />
            </Window>
          ) : (
            <Window title="Highland plot" className="rp-win" body={{ className: "rp-body" }}>
              <Text className="rp-title">Compare rotations</Text>
              <Segmented
                items={OPTIONS.map((o) => o.name)}
                value={s.sel}
                targets={["opt-0", "opt-1", "opt-2"]}
                cursor="pointer"
                className="rp-seg"
              />
              <div className="rp-col rp-col--solo" data-on>
                <Text className="rp-col__crops" wrap>
                  {OPTIONS[s.sel].crops}
                </Text>
                <div className="rp-col__row">
                  <Text className="rp-col__label">Drought resilience</Text>
                  <Badge tone={OPTIONS[s.sel].tone}>{OPTIONS[s.sel].resilience}</Badge>
                </div>
              </div>
              <Answer sel={s.sel} />
            </Window>
          )
        }
      </Stage>
    </div>
  );
}
