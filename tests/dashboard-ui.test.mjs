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

test("market share is compact inside the BTC hero and has all public-feed cards", async () => {
  const [html, app, dominance, i18n] = await Promise.all([read("index.html"), read("app.js"), read("market-dominance-client.js"), read("i18n.js")]);
  assert.ok(html.indexOf("marketDominanceTitle") > html.indexOf("hero-weather-panel"));
  assert.ok(html.indexOf("marketDominanceTitle") < html.indexOf("core-metrics-section"));
  assert.match(html, /id="marketDominanceContext"/);
  for (const label of ["BTC.D", "USDT.D", "USDC.D"]) assert.match(app, new RegExp(label.replace(".", "\\.")));
  assert.match(app, /dominance-occupancy/);
  assert.match(app, /showForBitcoin = selectedAssetId === "BTCUSD"/);
  assert.match(app, /context\.hidden = !showForBitcoin/);
  assert.match(app, /item\.value\.toFixed\(1\).*: "—"/);
  assert.match(dominance, /COINGECKO GLOBAL MARKET CAP/);
  assert.match(app, /tr\("free"\)/);
  assert.match(i18n, /free: "무료"/);
  assert.match(html, /공개 시장 환경 · 10분 갱신/);
});

test("core dynamics show real values or an explicit accumulation state without leader copy", async () => {
  const [html, app, css] = await Promise.all([read("index.html"), read("app.js"), read("styles.css")]);
  for (const required of ["날씨 지속력", "날씨 변화율", "시장 리드 타임프레임", "현재 시장을 리드하는 타임프레임을 확인하세요.", "관측 축적 중", "유효 관측이 쌓이면 표시합니다.", "corePersistenceBand", "coreChangeBand", "coreDynamicsHelp"]) assert.match(html, new RegExp(required));
  for (const removed of ["현재 시장 날씨를 가장 강하게 이끄는 시간축", "하위 시간축에는 상대적으로 노이즈 비중이 높을 수 있습니다.", ">Persistence<", ">Change Rate<", ">Waiting<"]) assert.doesNotMatch(html, new RegExp(removed));
  assert.match(app, /updateCoreMetric/);
  assert.match(app, /updateLeaderTimeframe/);
  assert.match(app, /currentWeatherEngineResult\(\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /420ms/);
  assert.match(css, /core-metric-leader\.is-updated/);
});

test("the completed hero uses the official app mark and a summarized public BTC receipt", async () => {
  const [html, app, css] = await Promise.all([read("index.html"), read("app.js"), read("styles.css")]);
  assert.match(html, /class="logo brand-mark" id="brandMark" src="\.\/icons\/ailynx-brand\.jpg"/);
  assert.match(html, /id="brandFallback" hidden/);
  assert.match(html, /class="asset-navigation" id="assetNavigation"/);
  assert.doesNotMatch(html, /asset-select-label/);
  assert.match(app, /capturePublicWeatherSnapshot/);
  assert.match(app, /heroWeatherPhase/);
  assert.match(app, /validationCardsData = hasFeature\("viewer\.professional_details"\) \? nextCards : null/);
  assert.match(app, /label: "관측 준비 중"/);
  assert.match(css, /\.brand-mark/);
  assert.match(css, /object-fit: contain/);
  assert.match(css, /clamp\(56px, 5vw, 64px\)/);
});

test("asset navigation has four accessible canonical controls and no hero dropdown", async () => {
  const [html, app, registry, css] = await Promise.all([read("index.html"), read("app.js"), read("asset-registry.js"), read("styles.css")]);
  assert.match(html, /class="asset-navigation" id="assetNavigation"/);
  assert.doesNotMatch(html, /assetSelector|asset-access-section|assetAccessList/);
  for (const required of ["renderAssetNavigation", "aria-current", "requestAssetAccess", "asset-navigation-item", "focus-visible"]) assert.match(`${app}\n${css}`, new RegExp(required));
  for (const label of ["비트코인", "나스닥 100", "금", "달러 인덱스"]) assert.match(registry, new RegExp(label));
  assert.doesNotMatch(registry, /label: "GOLD"|label: "NASDAQ"/);
  assert.match(registry, /BTCUSD[\s\S]*US100[\s\S]*XAUUSD[\s\S]*DXY/);
});

test("asset navigation separates entitlement from the selected state", async () => {
  const [app, css] = await Promise.all([read("app.js"), read("styles.css")]);
  assert.match(app, /asset-navigation-access/);
  assert.match(app, /asset\.id === selectedAssetId/);
  assert.match(app, /asset\.id === "BTCUSD" \? "실시간"/);
  assert.match(css, /\.asset-navigation-item\.is-selected/);
  assert.match(app, /createPlanLockIcon/);
  assert.match(css, /\.plan-lock-icon/);
});

test("dashboard cache shell includes the membership resolver and has no removed UI modules", async () => {
  const [html, worker] = await Promise.all([read("index.html"), read("service-worker.js")]);
  assert.match(worker, /ailynx-weather-v43/);
  for (const asset of ["styles.css?v=31", "icons/ailynx-brand.jpg", "asset-registry.js?v=4", "/api/public-runtime-config.js", "public-runtime-config.js?v=1", "community-config.js?v=3", "admin-access.js?v=1", "auth-client.js?v=1", "membership-client.js?v=2", "core-dynamics.js?v=1", "i18n.js?v=5", "member-community.js?v=4", "auth-gate.js?v=4", "app.js?v=35"]) {
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
  assert.match(app, /change\.textContent = !allowed \? ""/);
  assert.match(app, /frame-entitlement/);
  assert.match(app, /assetReadPath\?\.reconcileAccess\?\.?\(\)/);
  assert.match(membership, /subscriptions\.plan_code/);
  assert.match(membership, /source: "unavailable"/);
  assert.match(app, /function assetEntitled\(assetId\)/);
  assert.match(app, /AiLynxAssetRegistry\?\.byId\?\.\(assetId\)\?\.requiredPlan/);
  assert.match(app, /requiredPlan && planAtLeast\(requiredPlan\)/);
  assert.match(registry, /US100[\s\S]*requiredPlan: "FREE"/);
  assert.match(registry, /XAUUSD[\s\S]*requiredPlan: "WEATHER"/);
  assert.match(registry, /DXY[\s\S]*requiredPlan: "WEATHER"/);
});

test("asset selection still delegates through the isolated read path", async () => {
  const app = await read("app.js");
  assert.match(app, /const observationHistory = recordWeatherObservation\(result\)/);
  assert.match(app, /void selectAsset\(asset\.id\)/);
  assert.match(app, /renderAssetNavigation\(\)/);
  assert.doesNotMatch(app, /initializeAssetSelector|asset-selector-toggle/);
  assert.match(app, /currentAssetObservation/);
});

test("leader timeframe is a WEATHER gate with no FREE value exposure", async () => {
  const [html, app, config, css] = await Promise.all([read("index.html"), read("app.js"), read("lynx-dashboard-config.js"), read("styles.css")]);
  assert.match(config, /WEATHER: Object\.freeze\(\{label: "플러스"/);
  assert.match(config, /FREE: Object\.freeze\(\{label: "무료"/);
  assert.match(config, /PREMIUM: Object\.freeze\(\{label: "프리미엄"/);
  assert.match(config, /PRO: Object\.freeze\(\{label: "프로"/);
  assert.match(html, /id="coreLeaderLock"/);
  assert.match(html, /플러스에서 확인/);
  assert.match(html, /id="coreLeaderCta"/);
  assert.match(app, /const leaderAllowed = planAtLeast\("WEATHER"\)/);
  assert.match(app, /const leader = leaderAllowed \?/);
  assert.match(app, /dashboardText\("coreLeaderTimeframe", allowed \? value : planDisplayName\("WEATHER"\)\)/);
  assert.match(css, /core-metric-leader\[data-state="locked"\]/);
});

test("daily timeframe locks follow Plus for 1D and Premium for 2D through 1W", async () => {
  const [app, config] = await Promise.all([read("app.js"), read("lynx-dashboard-config.js")]);
  assert.match(app, /function requiredPlanForTimeframe\(timeframe, kind\)/);
  assert.match(app, /kind === "daily"\) return timeframe === "1D" \? "WEATHER" : "PREMIUM"/);
  assert.match(app, /const requiredPlan = requiredPlanForTimeframe\(timeframe, kind\)/);
  assert.match(config, /WEATHER[\s\S]*daily: \["1D"\]/);
  assert.match(config, /PREMIUM[\s\S]*daily: \["1D", "2D", "3D", "4D", "5D", "6D", "1W"\]/);
});
