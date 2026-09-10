import {ASSET_READERS} from "./asset-registry.js";
import {fetchAssetHistory, fetchAssetObservations} from "./as1-asset-client.js";
import {fetchValidationCards} from "./as1-validation-client.js";
import {assetPriceUnit, formatAssetPrice} from "./asset-presentation.js";
import {createWeatherSymbol} from "./weather-symbols.js";

const VIEW_TIMEFRAME = "4H";
let selectedAsset = "BTCUSD";

const text = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
const setHidden = (id, hidden) => { const node = document.getElementById(id); if (node) node.hidden = hidden; };
const time = (value) => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("ko-KR", {timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false}).format(new Date(value)) : "데이터 없음";
const stateName = (value) => ({RAIN: "비", CLOUDY: "흐림", PARTLY_CLOUDY: "구름 조금", SUNNY: "맑음"}[value] || "데이터 없음");
const sourceName = (source) => ({LIVE_CURRENT: "LIVE", LAST_KNOWN_GOOD: "마지막 관측", RECOVERED_HISTORY: "복구 관측"}[source] || "데이터 없음");

export function mobileViewerAccess(membership, isAdmin) {
  return membership?.plan === "PRO" || isAdmin === true;
}

export function selectSameTimeframeReceipt(observation, timeframe = VIEW_TIMEFRAME) {
  if (!observation?.available || typeof timeframe !== "string") return null;
  const candidates = [
    ["LIVE_CURRENT", observation.currentTimeframes?.[timeframe]],
    ["LAST_KNOWN_GOOD", observation.lastKnownGoodTimeframes?.[timeframe]],
    ["RECOVERED_HISTORY", observation.recoveredTimeframes?.[timeframe]],
  ];
  const match = candidates.find(([, receipt]) => receipt?.asset === observation.asset && receipt?.timeframe === timeframe);
  return match ? {source: match[0], receipt: match[1]} : null;
}

function authorized() {
  return mobileViewerAccess(window.AiLynxMembership?.membership?.(), window.AiLynxAdminAccess?.hasFullAccess?.() === true);
}

async function refreshEntitlement() {
  await window.AiLynxMembership?.refresh?.();
  await window.AiLynxAdminAccess?.refresh?.();
  const allowed = authorized();
  setHidden("mobileViewerLocked", allowed);
  setHidden("mobileViewerData", !allowed);
  if (!allowed) {
    text("mobileViewerGate", "모바일 뷰어는 PRO 전용 기능입니다.");
    return false;
  }
  return true;
}

function renderAssets() {
  const target = document.getElementById("mobileViewerAssets");
  if (!target) return;
  target.replaceChildren(...Object.values(ASSET_READERS).map((asset) => {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = asset.label; button.dataset.asset = asset.id;
    button.classList.toggle("is-active", asset.id === selectedAsset);
    button.addEventListener("click", () => { selectedAsset = asset.id; renderAssets(); void loadSelectedAsset(); });
    return button;
  }));
}

function historySnapshot(asset, receipt) {
  const classified = window.AiLynxWeatherEngine?.classifyWeather?.(receipt.score);
  if (!classified || !Number.isFinite(receipt.score)) return null;
  return {assetId: asset, timeframe: receipt.timeframe, majorTimeframe: receipt.timeframe, score: receipt.score, state: classified.state, valid: true, noise: 0, quality: receipt.sensorQuality === "GOOD" ? "GOOD" : receipt.sensorQuality === "LIMITED" ? "LIMITED" : "WATCH", freshness: receipt.freshness};
}

function renderMetric(id, value) {
  text(id, Number.isFinite(value) ? `${Math.round(value)}` : "관측 축적 중");
}

function renderPrecision(cards) {
  const summary = document.getElementById("mobileViewerPrecision");
  if (!summary) return;
  const stopwatch = cards?.maat?.payload?.stopwatch;
  if (!cards?.maat?.available || !Number.isFinite(stopwatch?.main_tf_minutes)) { summary.textContent = "정밀 관측 데이터 없음"; return; }
  const tf = stopwatch.main_tf_minutes % 1440 === 0 ? `${stopwatch.main_tf_minutes / 1440}D` : `${stopwatch.main_tf_minutes / 60}H`;
  const phase = {WINDOW_OPEN: "관측 창 열림", WAIT: "관측 대기", QUIET: "조용함", NOISE_ONLY: "노이즈 우세", VOL_TRIGGER_WAIT: "거래량 신호 대기"}[String(stopwatch.phase || "").toUpperCase()] || "정밀 관측 상태 확인";
  const noise = Number.isFinite(stopwatch.noise_score) ? stopwatch.noise_score <= 33 ? "노이즈 낮음" : stopwatch.noise_score <= 66 ? "노이즈 보통" : "노이즈 높음" : "노이즈 데이터 없음";
  summary.textContent = `${tf} 중심 · ${phase} · ${noise}`;
}

async function loadPrecision() {
  if (selectedAsset !== "BTCUSD") { renderPrecision(null); return; }
  try { renderPrecision(await fetchValidationCards({timeframe: "240"})); } catch { renderPrecision(null); }
}

async function loadSelectedAsset() {
  if (!authorized()) return;
  const asset = selectedAsset;
  text("mobileViewerStatus", "관측을 불러오는 중");
  const [observation, history] = await Promise.all([fetchAssetObservations({asset}), fetchAssetHistory({asset, timeframe: VIEW_TIMEFRAME, limit: 4})]);
  if (asset !== selectedAsset || !authorized()) return;
  const chosen = selectSameTimeframeReceipt(observation, VIEW_TIMEFRAME);
  if (!chosen) {
    text("mobileViewerPrice", "—"); text("mobileViewerWeather", "데이터 없음"); text("mobileViewerScore", "—"); text("mobileViewerStatus", "4H 관측 데이터 없음");
    text("mobileViewerObservedAt", "데이터 없음"); text("mobileViewerPersistence", "관측 축적 중"); text("mobileViewerChange", "관측 축적 중");
    document.getElementById("mobileViewerIcon")?.replaceChildren(createWeatherSymbol("WAITING"));
    await loadPrecision(); return;
  }
  const {receipt, source} = chosen;
  const weather = window.AiLynxWeatherEngine?.classifyWeather?.(receipt.score);
  text("mobileViewerAsset", ASSET_READERS[asset].label);
  text("mobileViewerPrice", formatAssetPrice(receipt.barClose, asset));
  text("mobileViewerUnit", assetPriceUnit(asset) || "");
  text("mobileViewerWeather", stateName(weather?.state)); text("mobileViewerScore", Number.isFinite(receipt.score) ? `${Math.round(receipt.score)}` : "데이터 없음");
  text("mobileViewerStatus", sourceName(source)); text("mobileViewerObservedAt", time(receipt.receivedAt));
  document.getElementById("mobileViewerIcon")?.replaceChildren(createWeatherSymbol(weather?.icon || "WAITING"));
  const snapshots = history?.available ? history.history.map((item) => historySnapshot(asset, item)).filter(Boolean) : [];
  renderMetric("mobileViewerPersistence", window.AiLynxWeatherEngine?.computeDurability?.(snapshots));
  renderMetric("mobileViewerChange", window.AiLynxWeatherEngine?.computeChangeRate?.(snapshots));
  await loadPrecision();
}

async function boot() {
  if (!await refreshEntitlement()) return;
  renderAssets();
  await loadSelectedAsset();
}

function reconcileAccess() {
  const allowed = authorized();
  setHidden("mobileViewerLocked", allowed);
  setHidden("mobileViewerData", !allowed);
  if (!allowed) { text("mobileViewerGate", "모바일 뷰어는 PRO 전용 기능입니다."); return; }
  renderAssets();
  void loadSelectedAsset();
}

if (typeof window !== "undefined") {
  window.addEventListener("ailynx-membership", reconcileAccess);
  window.addEventListener("ailynx-admin", reconcileAccess);
  void boot();
}
