import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import "chartjs-adapter-date-fns";
import type { ChartDataSet, WeightUnit } from "./model";

Chart.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend, Filler);

export function renderChart(
  canvas: HTMLCanvasElement,
  dataset: ChartDataSet,
  preferredUnit: WeightUnit
): Chart {
  const { dataPoints, trendline, floor, ceiling, ideal } = dataset;

  const datasets: Chart["data"]["datasets"] = [];

  // Data points series
  datasets.push({
    label: "Weight",
    data: dataPoints.map((p) => ({ x: p.date.getTime(), y: p.value })),
    borderColor: "#0066cc",
    backgroundColor: "#0066cc",
    pointRadius: 4,
    pointHoverRadius: 6,
    tension: 0,
    showLine: false,
  } as never);

  // Trendline series
  if (trendline) {
    datasets.push({
      label: "Trend",
      data: trendline.map((p) => ({ x: p.date.getTime(), y: p.value })),
      borderColor: "#888888",
      borderDash: [6, 3],
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0,
      fill: false,
    } as never);
  }

  // Floor series
  if (floor) {
    datasets.push({
      label: "Floor",
      data: floor.map((p) => ({ x: p.date.getTime(), y: p.value })),
      borderColor: "#27ae60",
      borderDash: [4, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0,
      fill: false,
    } as never);
  }

  // Ceiling series
  if (ceiling) {
    datasets.push({
      label: "Ceiling",
      data: ceiling.map((p) => ({ x: p.date.getTime(), y: p.value })),
      borderColor: "#c0392b",
      borderDash: [4, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0,
      fill: false,
    } as never);
  }

  // Ideal series
  if (ideal) {
    datasets.push({
      label: "Ideal",
      data: ideal.map((p) => ({ x: p.date.getTime(), y: p.value })),
      borderColor: "#8e44ad",
      borderDash: [4, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0,
      fill: false,
    } as never);
  }

  return new Chart(canvas, {
    type: "line",
    data: { datasets },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
            displayFormats: { day: "d MMM" },
          },
          ticks: { maxTicksLimit: 8 },
        },
        y: {
          title: {
            display: true,
            text: preferredUnit,
          },
        },
      },
      plugins: {
        legend: { display: true },
        tooltip: { mode: "index", intersect: false },
      },
    },
  });
}
