/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AboutDataPage from "@/app/(app)/about/data/page";
import { ReportView } from "@/components/field/report-view";
import { syntheticField, rotation, slot } from "../helpers/synthetic";

vi.mock("@/lib/nasa/earthdata", () => ({ earthdataConfigured: () => true }));
vi.mock("@/lib/analysis/use-analysis", () => ({ useFieldAnalysis: () => ({ phase: "ready", engineData: null, conditions: null, retry: vi.fn() }) }));
const state = vi.hoisted(() => ({ field: {} as object, rotations: [] as object[] }));
vi.mock("@/lib/store/fields-store", () => ({
  useFieldsStore: (select: (s: object) => unknown) => select({ status: "ready", fields: [state.field], load: vi.fn(), loadRotations: vi.fn() }),
  useFieldRotations: () => state.rotations,
}));

afterEach(cleanup);
describe("release truthfulness", () => {
  it("never promotes configured credentials to successful retrieval", () => {
    render(<AboutDataPage />);
    expect(screen.getAllByText("Credentials configured; unverified")).toHaveLength(3);
    expect(screen.getByText("Proposed")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.queryByText("Working")).not.toBeInTheDocument();
  });
  it("does not label an unconfirmed field as a field-informed report", () => {
    state.field = syntheticField({ locationConfirmed: false });
    state.rotations = [rotation("f1", [slot("s", "sesame", "2026-05-15", "2026-08-15")])];
    render(<ReportView fieldId="f1" />);
    expect(screen.getByRole("heading", { name: "Confirm your field and crop sequence" })).toBeInTheDocument();
    expect(screen.queryByText(/Field-informed adviser summary/)).not.toBeInTheDocument();
  });
});
