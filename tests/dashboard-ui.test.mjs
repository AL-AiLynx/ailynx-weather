import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("dashboard provides a config-driven Lynx timeframe board without invented metrics", async () => {
  const [html, app, config, css, worker, notices] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("lynx-dashboard-config.js", root), "utf8"),
    readFile(new URL("styles.css", root), "utf8"),
    readFile(new URL("service-worker.js", root), "utf8"),
    readFile(new URL("lynx-notices.js", root), "utf8"),
  ]);
  for (const marker of ["dailyFrameStrip", "timeframeMatrix", "marketDominanceStrip", "assetAccessList", "heroPersistence", "heroChange", "localClock", "weatherPanel", "aiPanel", "communityPanel", "lastObservation", "visitStats"]) {
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
  assert.match(worker, /ailynx-weather-v23/);
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
  assert.match(app, /activePlan !== "PRO"/);
  assert.match(app, /MAAT2 precision validation/);
  for (const weatherClass of ["weather--sunny", "weather--partly-cloudy", "weather--cloudy", "weather--rain", "weather--neutral"]) assert.match(css, new RegExp(weatherClass));
});
