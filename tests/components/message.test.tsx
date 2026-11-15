/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Message, type MessageTone } from "@/components/ui/message";
import { Evidence } from "@/components/ui/provenance";

const TONES: Array<[MessageTone, string]> = [
  ["info", "Note"],
  ["success", "Good"],
  ["caution", "Watch out"],
  ["problem", "Problem"],
  ["needs", "Needs your input"],
];

afterEach(cleanup);

describe("Message", () => {
  it.each(TONES)("%s shows a title and a spoken tone word, never colour alone", (tone, word) => {
    const { container } = render(
      <Message tone={tone} title="The finding">
        What to do next.
      </Message>,
    );
    expect(screen.getByText("The finding")).toBeInTheDocument();
    expect(screen.getByText(`${word}:`)).toHaveClass("sr-only");
    expect(screen.getByText("What to do next.")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("has no live role unless asked, so static notices do not interrupt", () => {
    const { rerender } = render(<Message tone="problem" title="Static" />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<Message tone="problem" role="alert" title="After an action" />);
    expect(screen.getByRole("alert")).toHaveTextContent("After an action");
    rerender(<Message tone="success" role="status" title="Saved" />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("renders the action and evidence slots in order", () => {
    render(
      <Message tone="needs" title="Add your sowing date" action={<a href="/x">Add date</a>} evidence={<Evidence scope="fao56" refText="FAO-56 Table 12" />}>
        Then this check can run.
      </Message>,
    );
    expect(screen.getByRole("link", { name: "Add date" })).toBeInTheDocument();
    expect(screen.getByText("Based on:")).toBeInTheDocument();
    expect(screen.getByText("FAO-56 Table 12")).toBeInTheDocument();
  });

  it("compact keeps the same words in one line without the icon circle", () => {
    const { container } = render(<Message tone="caution" compact title="Check locally" />);
    expect(screen.getByText("Check locally")).toBeInTheDocument();
    expect(container.querySelector(".size-9")).toBeNull();
  });
});

describe("Evidence", () => {
  it("falls back to the kind of source when a rule has no citation text", () => {
    render(<Evidence scope="ecocrop-reference" />);
    expect(screen.getByText("FAO ECOCROP crop database")).toBeInTheDocument();
  });

  it("links to the source when a URL exists", () => {
    render(<Evidence scope="fao56" refText="FAO-56" url="https://example.org/fao56" />);
    expect(screen.getByRole("link", { name: "open" })).toHaveAttribute("href", "https://example.org/fao56");
  });
});
