/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuestionForm } from "@/components/field/question-form";
import { LimitChecks, LimitSummary } from "@/components/field/limit-checks";
import { useFieldsStore } from "@/lib/store/fields-store";
import type { LimitCheck } from "@/lib/engine/limits";
import type { Field } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const field: Field = {
  id: "5b0a2f0e-0c1d-4c55-9d2a-1f3b7a8c9d10",
  name: "Paddy plot",
  geometry: { type: "Point", coordinates: [94.95, 20.15] },
  areaHa: 1,
  centroid: [94.95, 20.15],
  samplePoints: [[94.95, 20.15]],
  irrigation: "none",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("QuestionForm", () => {
  let update: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    push.mockClear();
    update = vi.fn().mockResolvedValue(field);
    useFieldsStore.setState({ status: "ready", fields: [field], rotations: {}, load: vi.fn(), loadRotations: vi.fn(), update } as never);
  });
  afterEach(cleanup);

  it("has a first-class 'I don't know' answer that is stored as the not-known value", async () => {
    render(<QuestionForm fieldId={field.id} questionId="market" />);
    expect(screen.queryByText(/Question \d+ of/)).toBeNull();
    expect(screen.getByText("This helps us:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Not now" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "I don't know" }));
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1].answers[0]).toMatchObject({ questionId: "market", value: "unsure" });
  });

  it("shows Saved before it moves on to the next question", async () => {
    render(<QuestionForm fieldId={field.id} questionId="market" />);
    fireEvent.click(screen.getByRole("radio", { name: "I don't know" }));
    fireEvent.click(screen.getByRole("button", { name: "Save answer" }));
    expect(await screen.findByText("Saved. We will treat this as not answered.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalled(), { timeout: 2000 });
  });
});

describe("Limit checks wording", () => {
  afterEach(cleanup);
  const notAsked = (limit: LimitCheck["limit"]): LimitCheck => ({ limit, result: "not-asked" }) as LimitCheck;

  it("says what was not checked and why, and offers 'Add limits'", () => {
    render(<LimitSummary fieldId="f1" checks={[notAsked("water"), notAsked("market")]} />);
    expect(screen.getByText(/We have not checked these because you have not told us: water, market\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add limits" })).toBeInTheDocument();
    expect(screen.queryByText(/Not checked yet|Not set yet/)).toBeNull();
  });

  it("uses one 'Not answered' tag and 'Add limits' in the full list", () => {
    render(<LimitChecks fieldId="f1" checks={[notAsked("water"), notAsked("market")]} />);
    expect(screen.getAllByText("Not answered").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Add limits" })).toBeInTheDocument();
    expect(screen.getByText("Crops I can sell")).toBeInTheDocument();
  });
});
