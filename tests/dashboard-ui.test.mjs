import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("dashboard provides a config-driven Lynx timeframe board without invented metrics", async () => {
  const [html, app, config, css, worker, notices, i18n, dynamics] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("lynx-dashboard-config.js", root), "utf8"),
    readFile(new URL("styles.css", root), "utf8"),
    readFile(new URL("service-worker.js", root), "utf8"),
    readFile(new URL("lynx-notices.js", root), "utf8"),
    readFile(new URL("i18n.js", root), "utf8"),
    readFile(new URL("weather-dynamics.js", root), "utf8"),
  ]);
  for (const marker of ["dailyFrameStrip", "timeframeMatrix", "marketDominanceStrip", "assetAccessList", "weatherFlowGraph", "dynamicsPersistence", "dynamicsChange", "dynamicsLeaderTimeframe", "localClock", "weatherPanel", "aiPanel", "communityPanel", "lastObservation", "visitStats"]) {
    assert.ok(html.includes(marker), `missing ${marker}`);
  }
  assert.match(config, /BTCUSD/);
  assert.match(config, /US100/);
  assert.match(config, /XAUUSD/);
  assert.match(config, /DXY/);
  assert.match(config, /weatherBands/);
  assert.match(config, /Array\.from\(\{length: 24}/);
  assert.match(app, /CALCULATING/);
  assert.match(app, /hideLegacyWeatherPanels/);
  assert.match(app, /refreshMarketPrice/);
  assert.match(app, /refreshMarketDominance/);
  assert.match(app, /refreshVisitStats/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /initializeTabs/);
  assert.match(html, /TIMEFRAME MATRIX/);
  assert.doesNotMatch(html, /확정 대신 조건|예언 대신 검증|오늘도 안전운전/);
  assert.match(css, /\.timeframe-matrix/);
  assert.match(css, /\.market-dominance-strip/);
  assert.match(css, /\.app-tabs/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(worker, /ailynx-weather-v30/);
  assert.match(worker, /market-dominance-client\.js\?v=15/);
  assert.match(worker, /visit-counter-client\.js\?v=15/);
  assert.match(worker, /lynx-dashboard-config\.js\?v=17/);
  assert.match(html, /announcementTicker/);
  assert.match(notices, /Lynx Weather Beta/);
  assert.match(app, /fetchHorusSnapshot/);
  assert.match(worker, /as1-horus-client\.js\?v=16/);
  assert.match(html, /marketAdvisory/);
  assert.match(worker, /market-advisory-config\.js\?v=1/);
  assert.match(worker, /auth-gate\.js\?v=2/);
  assert.match(worker, /i18n\.js\?v=2/);
  assert.match(worker, /app\.js\?v=25/);
  assert.match(worker, /asset-read-path\.js\?v=1/);
  assert.match(worker, /as1-asset-client\.js\?v=2/);
  assert.match(html, /heroAssetIdentity/);
  assert.match(html, /현재 리더 타임프레임/);
  assert.match(html, /타임프레임 우선/);
  assert.match(html, /날씨 흐름/);
  assert.match(html, /frontlineTimeframeStrip/);
  assert.match(app, /currentAssetObservation/);
  assert.match(app, /selectAsset/);
  assert.match(app, /renderFrontlineTimeframe/);
  assert.match(worker, /frontline-timeframe\.js\?v=1/);
  assert.match(worker, /weather-history\.js\?v=1/);
  assert.match(worker, /weather-dynamics\.js\?v=1/);
  assert.match(css, /frontline-timeframe-strip/);
  assert.match(css, /frontline-timeframe-node/);
  assert.doesNotMatch(html, /주요 구간|주요 기간|주요 우선 타임프레임/);
  assert.match(app, /setInterval\(renderLocalClock, 60000\)/);
  assert.doesNotMatch(app, /getSeconds\(\)/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
  assert.match(app, /weatherObservationHistory/);
  assert.match(app, /AiLynxWeatherHistory/);
  assert.match(app, /renderWeatherDynamics\(observationHistory, durability, changeRate, hero\)/);
  assert.match(app, /renderFrontlineTimeframe\(leaderTimeframe\(hero\)\)/);
  assert.match(app, /매우 강함/);
  assert.match(app, /매우 빠름/);
  assert.match(app, /최근 관측 기록을 모으는 중/);
  assert.match(html, /최근 관측 기록을 모으고 있습니다/);
  assert.match(dynamics, /buildWeatherFlow/);
  assert.match(dynamics, /weather-flow-line/);
  assert.match(css, /weather-dynamics-metrics/);
  assert.match(css, /weather-flow-svg/);
  assert.match(html, /brand-text[\s\S]*localClock/);
  assert.doesNotMatch(`${html}\n${i18n}`, /내후성|Weather Persistence/);
  assert.doesNotMatch(html, />Waiting</);
  assert.doesNotMatch(i18n, /: "[^"\n]*Waiting/);
  assert.match(app, /activePlan !== "PRO"/);
  assert.match(app, /precisionValidation/);
  for (const weatherClass of ["weather--sunny", "weather--partly-cloudy", "weather--cloudy", "weather--rain", "weather--neutral"]) assert.match(css, new RegExp(weatherClass));
});
