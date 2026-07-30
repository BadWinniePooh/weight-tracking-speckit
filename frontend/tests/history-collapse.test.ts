import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// FR-018 / FR-019: the History card is collapsed by default on every load and the
// fold wrapper must not change the #entry-list container contract.
const indexHtml = fs.readFileSync(
  path.join(__dirname, "..", "src", "index.html"),
  "utf-8"
);

describe("history card collapse (018)", () => {
  let doc: Document;

  beforeEach(() => {
    doc = new DOMParser().parseFromString(indexHtml, "text/html");
  });

  it("wraps the history card body in a DaisyUI collapse", () => {
    const collapse = doc.querySelector("section.history .collapse");
    expect(collapse).not.toBeNull();
    expect(collapse!.classList.contains("collapse-arrow")).toBe(true);
  });

  it("uses an unchecked checkbox so the card is folded on every load", () => {
    const toggle = doc.querySelector<HTMLInputElement>(
      "section.history .collapse > input#history-toggle"
    );
    expect(toggle).not.toBeNull();
    expect(toggle!.type).toBe("checkbox");
    expect(toggle!.hasAttribute("checked")).toBe(false);
  });

  it("keeps the History heading visible in the collapse title", () => {
    const heading = doc.querySelector(
      "section.history .collapse-title #history-heading"
    );
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toContain("History");
  });

  it("keeps #entry-list inside the collapse content, still wrapped for overflow", () => {
    const entryList = doc.querySelector(
      "section.history .collapse-content .overflow-x-auto > #entry-list"
    );
    expect(entryList).not.toBeNull();
    expect(entryList!.getAttribute("aria-label")).toBe("Weight entry history");
    // The container contract: renderEntryList owns everything inside #entry-list.
    expect(entryList!.children.length).toBe(0);
  });
});
