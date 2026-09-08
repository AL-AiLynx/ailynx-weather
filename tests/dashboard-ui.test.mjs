import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");

test("dashboard removes the weather flow graph and timeframe priority strip", async () => {
  const [html, app, css, worker] = await Promise.all([read("index.html"), read("app.js"), read("styles.css"), read("service-worker.js")]);
  for (const removed of ["weatherFlowGraph", "weather-flow-graph", "frontlineTimeframeStrip", "frontline-timeframe", "renderWeatherDynamics", "renderFrontlineTimeframe", "weather-dynamics.js", "frontline-timeframe.js"]) {
    assert.doesNotMatch(`${html}\n${app}\n${css}\n${worker}`, new RegExp(removed));
  }
});

test("dashboard retains weather history calculations without a graph renderer", async () => {
  const [app, worker, history] = await Promise.all([read("app.js"), read("service-worker.js"), read("weather-history.js")]);
  assert.match(app, /weatherObservationHistory/);
  assert.match(app, /recordWeatherObservation/);
  assert.match(app, /computeDurability/);
  assert.match(app, /computeChangeRate/);
  assert.match(worker, /weather-history\.js\?v=1/);
  assert.match(history, /mergeWeatherHistory/);
});

test("market share is immediately after the hero and has all public-feed cards", async () => {
  const [html, app, dominance, i18n] = await Promise.all([read("index.html"), read("app.js"), read("market-dominance-client.js"), read("i18n.js")]);
  assert.ok(html.indexOf("marketDominanceTitle") > html.indexOf("hero-weather-panel"));
  assert.ok(html.indexOf("marketDominanceTitle") < html.indexOf("dailyFramesTitle"));
  for (const label of ["BTC.D", "USDT.D", "USDC.D"]) assert.match(app, new RegExp(label.replace(".", "\\.")));
  assert.match(app, /dominance-occupancy/);
  assert.match(app, /item\.value\.toFixed\(1\).*: "—"/);
  assert.match(dominance, /COINGECKO GLOBAL MARKET CAP/);
  assert.match(app, /tr\("free"\)/);
  assert.match(i18n, /free: "무료"/);
  assert.match(html, /tenMinuteRefresh/);
});

test("core metrics use the requested labels and leader explanation", async () => {
  const [html, app] = await Promise.all([read("index.html"), read("app.js")]);
  for (const required of ["날씨 지속력", "날씨 변화율", "현재 리더 타임프레임", "현재 시장 날씨를 가장 강하게 이끄는 시간축", "하위 시간축에는 상대적으로 노이즈 비중이 높을 수 있습니다.", "관측 축적 중"]) assert.match(html, new RegExp(required));
  assert.match(app, /renderCoreMetrics/);
  assert.match(app, /leaderTimeframe/);
  assert.doesNotMatch(`${html}\n${app}`, /날씨 지구력|내후성|Weather Persistence/);
});

test("asset selector is a keyboard-accessible custom control with canonical labels", async () => {
  const [html, app, registry, css] = await Promise.all([read("index.html"), read("app.js"), read("asset-registry.js"), read("styles.css")]);
  assert.match(html, /class="asset-selector" id="assetSelector"/);
  for (const required of ["aria-haspopup", "aria-expanded", "listbox", "Escape", "pointerdown", "focus-visible", "asset-selector-option"]) assert.match(`${app}\n${css}`, new RegExp(required));
  for (const label of ["비트코인", "금", "달러 인덱스", "나스닥 100"]) assert.match(registry, new RegExp(label));
  assert.doesNotMatch(registry, /label: "GOLD"|label: "NASDAQ"/);
  for (const ticker of ["BTCUSD", "XAUUSD", "DXY", "US100"]) assert.match(registry, new RegExp(ticker));
});

test("observed market cards separate entitlement from observation state", async () => {
  const [app, css] = await Promise.all([read("app.js"), read("styles.css")]);
  assert.match(app, /asset-entitlement/);
  assert.match(app, /asset-observation/);
  assert.match(app, /entitlement\.textContent = allowed \? tr\("available"\) : asset\.requiredPlan/);
  assert.match(app, /observationState\.textContent = displayState\(availability\)/);
  assert.match(css, /\.asset-access \.asset-entitlement/);
});

test("dashboard cache shell includes the membership resolver and has no removed UI modules", async () => {
  const [html, worker] = await Promise.all([read("index.html"), read("service-worker.js")]);
  assert.match(worker, /ailynx-weather-v36/);
  for (const asset of ["styles.css?v=25", "asset-registry.js?v=4", "/api/public-runtime-config.js", "public-runtime-config.js?v=1", "auth-client.js?v=1", "membership-client.js?v=2", "i18n.js?v=4", "app.js?v=29"]) {
    assert.ok(html.includes(asset) || worker.includes(asset), `missing ${asset}`);
  }
  assert.doesNotMatch(worker, /frontline-timeframe|weather-dynamics/);
});

test("runtime plan gates use subscription canonical plans and never expose locked receipt details", async () => {
  const [app, config, registry, membership] = await Promise.all([read("app.js"), read("lynx-dashboard-config.js"), read("asset-registry.js"), read("membership-client.js")]);
  assert.doesNotMatch(`${app}\n${config}\n${registry}`, /activePlan|PLUS/);
  assert.match(config, /FREE.*WEATHER.*PRO.*PREMIUM/s);
  assert.match(app, /hasFeature\("viewer\.professional_details"\)/);
  assert.match(app, /const observation = allowed \?/);
  assert.match(app, /change\.textContent = !allowed \? tr\("upgrade"\)/);
  assert.match(app, /assetReadPath\?\.reconcileAccess\?\.?\(\)/);
  assert.match(membership, /subscriptions\.plan_code/);
  assert.match(membership, /source: "unavailable"/);
  assert.match(registry, /US100[\s\S]*requiredPlan: "WEATHER"/);
});

test("asset selection still delegates through the isolated read path", async () => {
  const app = await read("app.js");
  assert.match(app, /const observationHistory = recordWeatherObservation\(result\)/);
  assert.match(app, /await selectAsset\(asset\.id\)/);
  assert.match(app, /initializeAssetSelector\(\)/);
  assert.match(app, /currentAssetObservation/);
});
