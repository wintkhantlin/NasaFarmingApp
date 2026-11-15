import { Icon } from "@/components/ui/icon";
import { Panel, PanelHeader } from "@/components/ui/panel";

/** What the data cannot settle. Most important first, second most important last (serial position). */
export function CheckLocally({ cropNames }: { cropNames: string[] }) {
  const crops = cropNames.length ? cropNames.join(", ") : "these crops";
  const items = [
    `Which variety of ${crops} suits your soil and season`,
    "Pests and diseases reported this year",
    "Local flooding or frost on your land",
    "Land-use rules, especially on paddy land",
    "Buyer and price",
  ];
  return (
    <Panel as="section" aria-labelledby="check-locally" className="flex flex-col gap-3 p-4 sm:p-5">
      <PanelHeader id="check-locally" as="h3" title={<span className="inline-flex items-center gap-2"><Icon name="checklist" />Check locally</span>} description="Talk it through with your extension officer or an experienced farmer." />
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body text-ink">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2"><Icon name="check" size={18} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />{i}</li>
        ))}
      </ul>
    </Panel>
  );
}
