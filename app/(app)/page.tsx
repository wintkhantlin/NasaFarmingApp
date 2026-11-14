import { FieldsList } from "@/components/field/fields-list";
import { Button, ButtonRow } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { copy } from "@/lib/copy/en";

export default function Home() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title text-ink sm:text-display">{copy.home.title}</h1>
          <p className="max-w-measure text-body text-ink-muted">{copy.app.tagline}</p>
        </div>
        <ButtonRow>
          <Button href="/plan" variant="secondary">
            <Icon name="rotation" />
            {copy.home.exploreRotations}
          </Button>
          <Button href="/fields/new" variant="secondary">
            <Icon name="add" />
            {copy.home.addField}
          </Button>
        </ButtonRow>
      </div>
      <FieldsList />
    </>
  );
}
