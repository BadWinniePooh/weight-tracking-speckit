import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChartDataSet } from "../src/ts/model";

// ─── Mock Chart.js (canvas not available in jsdom) ────────────────────────────
// vi.mock is hoisted, so factory must be self-contained
vi.mock("chart.js", () => {
  const mockDestroy = vi.fn();
  const mockInstance = { destroy: mockDestroy, data: { datasets: [] as unknown[] } };
  const ChartMock = vi.fn().mockImplementation((_canvas: unknown, config: { data: { datasets: unknown[] } }) => {
    mockInstance.data.datasets = config.data.datasets;
    return mockInstance;
  }) as ReturnType<typeof vi.fn> & { register: ReturnType<typeof vi.fn> };
  ChartMock.register = vi.fn();
  return {
    Chart: ChartMock,
    LineController: {}, LineElement: {}, PointElement: {},
    LinearScale: {}, TimeScale: {}, Tooltip: {}, Legend: {}, Filler: {},
  };
});

vi.mock("chartjs-adapter-date-fns", () => ({}));

import { renderChart } from "../src/ts/chart";
import { Chart } from "chart.js";

// Access the shared mock instance through the Chart mock
const getLastInstance = () => {
  const calls = vi.mocked(Chart).mock.results;
  return calls[calls.length - 1]?.value as { destroy: ReturnType<typeof vi.fn>; data: { datasets: unknown[] } } | undefined;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCanvas(): HTMLCanvasElement {
  return document.createElement("canvas");
}

function makeDataset(overrides: Partial<ChartDataSet> = {}): ChartDataSet {
  return {
    dataPoints: [
      { date: new Date("2026-03-01"), value: 80 },
      { date: new Date("2026-03-02"), value: 79 },
    ],
    trendline: [
      { date: new Date("2026-03-01"), value: 80 },
      { date: new Date("2026-03-02"), value: 79 },
    ],
    floor: null,
    ceiling: null,
    ideal: null,
    corridorState: "no-goal",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(Chart).mockClear();
});

// ─── T013: Chart.ts integration tests ────────────────────────────────────────

describe("renderChart", () => {
  it("returns an object with a destroy method", () => {
    const canvas = makeCanvas();
    const instance = renderChart(canvas, makeDataset(), "kg");
    expect(instance).toBeDefined();
    expect(typeof instance.destroy).toBe("function");
  });

  it("includes data points dataset when dataPoints is non-empty", () => {
    const canvas = makeCanvas();
    renderChart(canvas, makeDataset(), "kg");
    const inst = getLastInstance();
    expect(inst?.data.datasets.length).toBeGreaterThanOrEqual(1);
  });

  it("includes trendline dataset when trendline is non-null", () => {
    const canvas = makeCanvas();
    renderChart(canvas, makeDataset(), "kg");
    const inst = getLastInstance();
    expect(inst?.data.datasets.length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT include floor/ceiling/ideal datasets when they are null", () => {
    const canvas = makeCanvas();
    renderChart(canvas, makeDataset({ floor: null, ceiling: null, ideal: null }), "kg");
    const inst = getLastInstance();
    // Only 2 datasets: data points + trendline
    expect(inst?.data.datasets.length).toBe(2);
  });

  it("includes floor, ceiling, ideal datasets when provided", () => {
    const corridorPts = [
      { date: new Date("2026-03-07"), value: 78 },
      { date: new Date("2026-03-08"), value: 77.9 },
    ];
    const dataset = makeDataset({
      floor: corridorPts,
      ceiling: corridorPts,
      ideal: corridorPts,
      corridorState: "ready",
    });
    const canvas = makeCanvas();
    renderChart(canvas, dataset, "kg");
    const inst = getLastInstance();
    // 5 datasets: data points + trendline + floor + ceiling + ideal
    expect(inst?.data.datasets.length).toBe(5);
  });

  it("calling destroy() on the returned instance does not throw", () => {
    const canvas = makeCanvas();
    const instance = renderChart(canvas, makeDataset(), "kg");
    expect(() => instance.destroy()).not.toThrow();
  });

  it("successive renderChart calls on a new canvas do not throw", () => {
    const canvas1 = makeCanvas();
    const canvas2 = makeCanvas();
    expect(() => {
      renderChart(canvas1, makeDataset(), "kg");
      renderChart(canvas2, makeDataset(), "kg");
    }).not.toThrow();
  });
});
