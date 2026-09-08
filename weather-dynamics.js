"use strict";

const WIDTH = 320;
const HEIGHT = 118;
const PADDING_X = 16;
const PADDING_Y = 16;

function validHistory(history, assetId, timeframe) {
  return Array.isArray(history)
    ? history.filter((item) => item?.assetId === assetId && item?.timeframe === timeframe &&
      Number.isFinite(item.score) && item.valid === true && ["FRESH", "AGING"].includes(item.freshness))
    : [];
}

function pointPath(points) {
  if (points.length < 2) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

export function buildWeatherFlow(history, {assetId, timeframe} = {}) {
  const observations = validHistory(history, assetId, timeframe).slice(-4);
  if (observations.length < 2) return Object.freeze({state: "EMPTY", observations, points: [], linePath: "", areaPath: ""});
  const usableWidth = WIDTH - (PADDING_X * 2);
  const usableHeight = HEIGHT - (PADDING_Y * 2);
  const points = observations.map((item, index) => Object.freeze({
    score: item.score,
    x: PADDING_X + ((usableWidth * index) / (observations.length - 1)),
    y: PADDING_Y + ((100 - item.score) / 100) * usableHeight,
    observedAt: item.observedAt,
  }));
  const linePath = pointPath(points);
  const last = points.at(-1);
  const first = points[0];
  return Object.freeze({
    state: "READY",
    observations: Object.freeze(observations),
    points: Object.freeze(points),
    linePath,
    areaPath: `${linePath} L${last.x.toFixed(2)} ${(HEIGHT - PADDING_Y).toFixed(2)} L${first.x.toFixed(2)} ${(HEIGHT - PADDING_Y).toFixed(2)} Z`,
  });
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

export function renderWeatherFlow(container, flow, labels = {}) {
  if (!container) return;
  container.replaceChildren();
  if (flow?.state !== "READY") {
    const empty = document.createElement("p");
    empty.className = "weather-flow-empty";
    empty.textContent = labels.empty ?? "최근 관측 기록을 모으는 중";
    container.append(empty);
    return;
  }
  const svg = svgElement("svg", {viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: "img", "aria-label": labels.aria ?? "최근 날씨 흐름"});
  svg.classList.add("weather-flow-svg");
  [25, 50, 75].forEach((score) => svg.append(svgElement("line", {class: "weather-flow-grid", x1: PADDING_X, x2: WIDTH - PADDING_X, y1: PADDING_Y + ((100 - score) / 100) * (HEIGHT - PADDING_Y * 2), y2: PADDING_Y + ((100 - score) / 100) * (HEIGHT - PADDING_Y * 2)})));
  svg.append(svgElement("path", {class: "weather-flow-area", d: flow.areaPath}));
  svg.append(svgElement("path", {class: "weather-flow-line", d: flow.linePath}));
  flow.points.forEach((point, index) => svg.append(svgElement("circle", {class: `weather-flow-point${index === flow.points.length - 1 ? " is-current" : ""}`, cx: point.x, cy: point.y, r: index === flow.points.length - 1 ? 4.5 : 3})));
  container.append(svg);
}

if (typeof window !== "undefined") window.AiLynxWeatherDynamics = Object.freeze({buildWeatherFlow, renderWeatherFlow});
