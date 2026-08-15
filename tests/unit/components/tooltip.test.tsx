// tests/unit/components/tooltip.test.tsx
//
// Smoke + behavioral coverage for components/ui/tooltip.tsx (P1.B
// follow-up #2). Uses happy-dom + react-dom/client directly to avoid
// pulling in @testing-library/react (intentionally not in the project's
// dep tree — kept tight for Vercel Hobby bundle). All four event
// handlers (`mouseEnter` / `mouseLeave` / `focus` / `blur`) need to
// show and hide the tooltip correctly so keyboard users and mouse
// users get the same UX.
//
// Why we test (vs. just trust the visual upgrade):
// - The conditional render relies on a `useState` flip, which is easy
//   to break with a future refactor (e.g., if someone switches to CSS
//   `:hover`, focus support silently disappears for keyboard users).
// - The component is reused across two surfaces (kanji-reading token
//   tooltip + fallback issue hint tooltip), so a regression here
//   cascades into multiple call sites.

import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { Tooltip } from "@/components/ui/tooltip";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(ui: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(ui);
  });
  return container;
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
});

function getTooltipBubble(host: Element): Element | null {
  // Tooltip renders a span with role="tooltip" when visible.
  return host.querySelector('[role="tooltip"]');
}

describe("Tooltip", () => {
  it("renders children without a tooltip bubble initially", () => {
    const host = mount(
      <Tooltip content="hint text">
        <button type="button">trigger</button>
      </Tooltip>
    );
    // Children are present.
    const btn = host.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe("trigger");
    // Tooltip bubble is hidden.
    expect(getTooltipBubble(host)).toBeNull();
  });

  it("shows the tooltip bubble on mouse enter and hides it on mouse leave", () => {
    const host = mount(
      <Tooltip content="hint text">
        <button type="button">trigger</button>
      </Tooltip>
    );
    // The Tooltip wraps children in a <span class="relative inline-flex ...">.
    const wrapper = host.querySelector("span.relative") as HTMLElement;
    expect(wrapper).not.toBeNull();

    // React's onMouseEnter listens for `mouseover` (which bubbles); the
    // native `mouseenter` event does NOT bubble so dispatching it would
    // be a no-op. Same idea for `mouseleave` → `mouseout`.
    act(() => {
      wrapper.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    let bubble = getTooltipBubble(host);
    expect(bubble).not.toBeNull();
    expect(bubble?.textContent).toContain("hint text");

    act(() => {
      wrapper.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    bubble = getTooltipBubble(host);
    expect(bubble).toBeNull();
  });

  it("shows the tooltip on focus and hides on blur (keyboard accessibility)", () => {
    const host = mount(
      <Tooltip content="hint text">
        <button type="button">trigger</button>
      </Tooltip>
    );
    const wrapper = host.querySelector("span.relative") as HTMLElement;
    expect(wrapper).not.toBeNull();

    // React's onFocus listens for `focusin` (which bubbles); native
    // `focus` does NOT bubble. Same for `onBlur` → `focusout`.
    act(() => {
      wrapper.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(getTooltipBubble(host)).not.toBeNull();

    act(() => {
      wrapper.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(getTooltipBubble(host)).toBeNull();
  });

  it("renders the tooltip with role=tooltip for screen readers", () => {
    const host = mount(
      <Tooltip content="aria label">
        <span>trigger</span>
      </Tooltip>
    );
    const wrapper = host.querySelector("span.relative") as HTMLElement;
    act(() => {
      wrapper.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    const bubble = getTooltipBubble(host);
    expect(bubble).not.toBeNull();
    expect(bubble?.getAttribute("role")).toBe("tooltip");
  });

  it("accepts a className prop and merges it into the wrapper", () => {
    const host = mount(
      <Tooltip content="x" className="inline-block custom-class">
        <span>trigger</span>
      </Tooltip>
    );
    const wrapper = host.querySelector("span.relative") as HTMLElement;
    expect(wrapper.className).toContain("custom-class");
    expect(wrapper.className).toContain("inline-block");
  });
});