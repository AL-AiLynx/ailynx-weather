import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("dashboard provides a config-driven Lynx timeframe board without invented metrics", async () => {
  const [html, app, config, css, worker] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("app.js", root), "utf8"),
    readFile(new URL("lynx-dashboard-config.js", root), "utf8"),
    readFile(new URL("styles.css", root), "utf8"),
    readFile(new URL("service-worker.js", root), "utf8"),
  ]);
  for (const marker of ["dailyFrameStrip", "timeframeMatrix", "assetAccessList", "heroPersistence", "heroChange", "localClock", "weatherPanel", "aiPanel", "communityPanel", "lastObservation"]) {
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
  assert.match(app, /visibilitychange/);
  assert.match(app, /initializeTabs/);
  assert.match(html, /타임프레임 매트릭스/);
  assert.doesNotMatch(html, /확정 대신 조건|예언 대신 검증|오늘도 안전운전/);
  assert.match(css, /\.timeframe-matrix/);
  assert.match(css, /\.app-tabs/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(worker, /ailynx-weather-v14/);
  assert.match(worker, /market-price-client\.js\?v=14/);
  assert.match(worker, /lynx-dashboard-config\.js\?v=14/);
});
