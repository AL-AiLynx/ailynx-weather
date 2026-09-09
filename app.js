+"use strict";

const APP_DATA_MODE = "AS1_LIVE";

/*
  AiLynx Bitcoin Weather
  weather-data.json을 읽어 화면에 표시
*/

const FALLBACK_DATA = {
  mode: "OFFLINE",
  price: 0,
  priceChange: 0,
  updatedAt: null,

  headline:
    "최신 날씨 데이터를 가져오지 못했습니다. 네트워크 연결 상태를 확인해 주세요.",

  weather: {
    icon: "CLOUDY",
    name: "데이터 대기",
    energy: 0
  },

  hourly: [],
  daily: [],

  mainTimeframe: "-",
  nextCheck: "-",

  watchLevel: {
    level: "UNKNOWN",
    text: "확인 필요",
    description:
      "최신 데이터가 연결되면 관찰 필요도를 다시 표시합니다."
  }
};

let weatherData = FALLBACK_DATA;
let baselineWeatherData = FALLBACK_DATA;
let hasLoadedWeatherData = false;
let freshnessIntervalId = null;
let as1ObservationRequestPromise = null;
let horusSnapshot = null;
let validationCardsData = null;
let publicWeatherSnapshot = null;
let heroWeatherPhase = "loading";
let validationTimeframe = "240";
let validationRequestPromise = null;
let marketPriceData = null;
let marketPriceRequestPromise = null;
let marketPriceIntervalId = null;
let selectedAssetId = "BTCUSD";
let selectedAssetObservation = null;
let assetReadPath = null;
let assetReadPathPromise = null;
const weatherObservationHistory = new Map();
const coreDynamicsValues = new Map();
let marketDominanceData = null;
let marketDominanceRequestPromise = null;
let marketDominanceIntervalId = null;
let visitStatsData = null;
let visitStatsRequestPromise = null;
let localClockIntervalId = null;
const dashboardConfig = window.LynxDashboardConfig;
const liveFetchAllowed = () => window.AiLynxAuthGate?.canFetchLive?.() ?? true;
const tr = (key, values) => window.AiLynxI18n?.t?.(key, values) ?? key;
const displayState = (value) => {
  const key = {WAITING: "waiting", PLANNED: "planned", LOCKED: "locked", LIVE: "live", STALE: "stale", INVALID: "invalid", "NO DATA": "noData", CALCULATING: "calculating", FULL: "fullObservation", CLOUDY: "cloudy", SUNNY: "sunny", PARTLY_CLOUDY: "partlyCloudy", RAIN: "rainy", RAINY: "rainy", NOISE_ONLY: "waiting"}[value];
  return key ? tr(key) : String(value || "").replaceAll("_", " ");
};

const STATUS_CLASSES = [
  "status-fresh",
  "status-delay",
  "status-stale",
  "status-expired",
  "status-offline",
  "status-error"
];


const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function createPlanLockIcon() {
  const svg = svgElement("svg", {viewBox: "0 0 24 24", focusable: "false", "aria-hidden": "true"});
  svg.classList.add("plan-lock-icon");
  svg.append(svgElement("path", {d: "M7.5 10V7.6a4.5 4.5 0 0 1 9 0V10M6.3 10h11.4c.7 0 1.3.6 1.3 1.3v8.2c0 .7-.6 1.3-1.3 1.3H6.3c-.7 0-1.3-.6-1.3-1.3v-8.2c0-.7.6-1.3 1.3-1.3Zm5.7 3.5v3.8", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round"}));
  return svg;
}

function createWeatherSymbol(iconCode) {
  const code = String(iconCode || "LOADING").toUpperCase();
  const svg = svgElement("svg", {viewBox: "0 0 64 64", focusable: "false", "aria-hidden": "true"});
  svg.classList.add("weather-symbol", `weather-symbol--${code.toLowerCase().replaceAll("_", "-")}`);
  const stroke = {fill: "none", stroke: "currentColor", "stroke-width": "3", "stroke-linecap": "round", "stroke-linejoin": "round"};
  const cloud = () => svg.append(svgElement("path", {...stroke, d: "M17 46h29a10 10 0 0 0 1.8-19.8A15 15 0 0 0 19.5 29 8.5 8.5 0 0 0 17 46Z"}));
  if (code === "SUNNY") {
    svg.append(svgElement("circle", {...stroke, cx: "32", cy: "32", r: "10"}));
    for (const [x1, y1, x2, y2] of [[32,7,32,14],[32,50,32,57],[7,32,14,32],[50,32,57,32],[14,14,19,19],[45,45,50,50],[50,14,45,19],[19,45,14,50]]) svg.append(svgElement("path", {...stroke, d: `M${x1} ${y1} ${x2} ${y2}`}));
  } else if (code === "PARTLY_CLOUDY" || code === "MOSTLY_CLOUDY") {
    svg.append(svgElement("circle", {...stroke, cx: "24", cy: "23", r: "9"}));
    cloud();
  } else if (["RAIN", "SHOWERS", "STORM"].includes(code)) {
    cloud();
    for (const [x1, y1, x2, y2] of [[23,50,20,56],[33,50,30,56],[43,50,40,56]]) svg.append(svgElement("path", {...stroke, d: `M${x1} ${y1} ${x2} ${y2}`}));
  } else if (code === "LOADING" || code === "WAITING") {
    svg.append(svgElement("circle", {...stroke, cx: "32", cy: "32", r: "15", "stroke-dasharray": "52 16"}));
    svg.append(svgElement("path", {...stroke, d: "M32 17v4"}));
  } else {
    cloud();
    svg.append(svgElement("path", {...stroke, d: "M22 52h20"}));
  }
  return svg;
}

function renderWeatherIcon(iconCode) {
  const target = document.getElementById("heroWeatherIcon");
  if (!target) return;
  const code = String(iconCode || "LOADING").toUpperCase();
  target.dataset.icon = code;
  target.replaceChildren(createWeatherSymbol(code));
}


/*
  JSON 데이터 불러오기
*/
async function loadWeatherData() {
  try {
    const response = await fetch(
      "./weather-data.json",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `날씨 데이터 응답 오류: ${response.status}`
      );
    }

    const data = await response.json();

    if (
      typeof data.price !== "number" ||
      !data.weather
    ) {
      throw new Error(
        "날씨 데이터 형식이 올바르지 않습니다."
      );
    }

    baselineWeatherData = data;
    weatherData = baselineWeatherData;
    hasLoadedWeatherData = true;

    console.log(
      "AiLynx JSON 데이터 연결 성공"
    );
  } catch (error) {
    console.error(
      "AiLynx JSON 데이터 연결 실패:",
      error
    );

    if (!hasLoadedWeatherData) {
      baselineWeatherData = FALLBACK_DATA;
      weatherData = baselineWeatherData;
    }
  }
}


/*
  가격 표시
*/
function formatPrice(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "데이터 대기";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}


/*
  470M → 470분
*/
function formatTimeframe(value) {
  if (typeof value !== "string") {
    return "-";
  }

  const minuteMatch =
    value.match(/^(\d+)M$/);

  if (minuteMatch) {
    return `${minuteMatch[1]}분`;
  }

  return value;
}


/*
  데이터 관측 시각 처리
*/
function parseUpdatedAt(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}


async function applyHorusSampleOverlay() {
  if (APP_DATA_MODE !== "HORUS_SAMPLE") {
    return;
  }

  const engine = window.AiLynxWeatherEngine;

  if (!engine) {
    console.warn("AiLynx HORUS 엔진을 찾을 수 없습니다.");
    return;
  }

  if (typeof engine.translateHorusToWeather !== "function") {
    console.warn("AiLynx HORUS 변환 함수를 찾을 수 없습니다.");
    return;
  }

  try {
    const response = await fetch(
      "./horus-sample.json",
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `HORUS 샘플 응답 오류: ${response.status}`
      );
    }

    const input = await response.json();
    const result =
      engine.translateHorusToWeather(input);

    if (!result || typeof result !== "object") {
      console.warn("AiLynx HORUS 변환 결과가 없습니다.");
      return;
    }

    if (result.ruleId === "NO_MATCHING_RULE") {
      console.warn("AiLynx HORUS 일치 규칙이 없습니다.");
      return;
    }

    if (
      !result.weather ||
      !result.watchLevel ||
      typeof result.weather !== "object" ||
      typeof result.watchLevel !== "object"
    ) {
      console.warn("AiLynx HORUS 핵심 결과가 없습니다.");
      return;
    }

    weatherData = {
      ...weatherData,
      headline:
        result.headline ?? weatherData.headline,
      weather: {
        ...weatherData.weather,
        icon:
          result.weather.icon ?? weatherData.weather.icon,
        name:
          result.weather.name ?? weatherData.weather.name,
        energy:
          result.weather.energy === null ||
          Number.isFinite(result.weather.energy)
            ? result.weather.energy
            : weatherData.weather.energy
      },
      watchLevel: {
        ...weatherData.watchLevel,
        level:
          result.watchLevel.level ??
          weatherData.watchLevel.level,
        text:
          result.watchLevel.text ??
          weatherData.watchLevel.text,
        description:
          result.watchLevel.description ??
          weatherData.watchLevel.description
      }
    };

    console.log(
      "AiLynx HORUS 샘플 적용 성공:",
      {
        ruleId: result.ruleId,
        condition: result.condition,
        weather: result.weather.name,
        watchLevel: result.watchLevel.level
      }
    );
  } catch (error) {
    console.error(
      "AiLynx HORUS 샘플 적용 실패:",
      error
    );
  }
}


function displayAs1Timeframe(timeframe) {
  if (timeframe === "D" || timeframe === "1D" || timeframe === "1440") return "1D";
  const minutes = Number(timeframe);
  return Number.isFinite(minutes) && minutes > 0 && minutes % 60 === 0
    ? `${minutes / 60}H`
    : String(timeframe || "-");
}

async function applyAs1LiveOverlay() {
  if (APP_DATA_MODE !== "AS1_LIVE") {
    return false;
  }

  if (as1ObservationRequestPromise) {
    return as1ObservationRequestPromise;
  }

  as1ObservationRequestPromise = (async () => {
    try {
      const [observationClient, horusClient] = await Promise.all([
        import("./as1-observation-client.js?v=10"),
        import("./as1-horus-client.js?v=16"),
      ]);
      const [result, horus] = await Promise.all([
        observationClient.fetchAs1Observation({
          asset: "COINBASE:BTCUSD", observer: "MAAT", packetType: "VALIDATION_SNAPSHOT", timeframe: "240",
        }),
        horusClient.fetchHorusSnapshot(),
      ]);
      if (horus.applied) horusSnapshot = horus;

      if (!result.available && !horus.applied) {
        console.warn(
          "AiLynx AS1 Live 데이터 미적용:",
          result.reason
        );
        return false;
      }

      const primaryHorus = horus.applied
        ? horus.timeframes["4H"]?.available ? horus.timeframes["4H"] : Object.values(horus.timeframes).find((item) => item.available)
        : null;
      weatherData = {
        ...weatherData,
        mode: "AS1_LIVE",
        price: primaryHorus?.bar?.close ?? result.bar?.close ?? weatherData.price,
        updatedAt: primaryHorus?.receivedAt ?? result.receivedAt ?? weatherData.updatedAt,
        mainTimeframe: primaryHorus?.timeframe ?? (result.available ? displayAs1Timeframe(result.timeframe) : "WAITING"),
        as1Live: {
          freshness: primaryHorus?.freshness ?? result.freshness,
          barCloseTime: primaryHorus?.barCloseTime ?? result.barCloseTime
        }
      };

      console.log(
        "AiLynx AS1 Live 4H 데이터 적용 성공"
      );
      return true;
    } catch {
      console.warn(
        "AiLynx AS1 Live client를 사용할 수 없습니다."
      );
      return false;
    }
  })();

  try {
    return await as1ObservationRequestPromise;
  } finally {
    as1ObservationRequestPromise = null;
  }
}


async function applyConfiguredOverlay() {
  if (APP_DATA_MODE === "AS1_LIVE") {
    return applyAs1LiveOverlay();
  }

  if (APP_DATA_MODE === "HORUS_SAMPLE") {
    await applyHorusSampleOverlay();
  }

  return false;
}

function weatherTimeframeLabel(timeframe = validationTimeframe) {
  return timeframe === "240" ? "4H" : timeframe === "480" ? "8H" : timeframe === "720" ? "12H" : "1D";
}

function capturePublicWeatherSnapshot(cards, timeframe) {
  const weatherTimeframe = weatherTimeframeLabel(timeframe);
  const horus = horusSnapshot?.timeframes?.[weatherTimeframe];
  const result = window.AiLynxWeatherEngine?.computeWeatherScore?.({timeframe: weatherTimeframe, horus, maat: cards?.maat, hub: cards?.maat2?.hub, time: cards?.maat2?.time}) ?? null;
  const parentMinutes = cards?.maat2?.time?.available ? cards.maat2.time.payload?.time?.parent_tf_minutes : cards?.maat?.available ? cards.maat.payload?.stopwatch?.parent_tf_minutes : null;
  if (!result || !horus?.available || horus.quality?.valid !== true || !["FRESH", "AGING"].includes(horus.freshness)) {
    publicWeatherSnapshot = null;
    return false;
  }
  const conflictCount = cards?.maat?.payload?.aggregate?.conflict_count;
  publicWeatherSnapshot = Object.freeze({
    result: Object.freeze({...result}),
    leaderTimeframe: Number.isFinite(parentMinutes) ? formatValidationTfMinutes(parentMinutes) : weatherTimeframe,
    receipt: Object.freeze({receivedAt: horus.receivedAt, freshness: horus.freshness, quality: Object.freeze({...horus.quality})}),
    noise: Number.isFinite(cards?.maat?.payload?.stopwatch?.noise_score) ? cards.maat.payload.stopwatch.noise_score : 0,
    quality: Number.isFinite(conflictCount) && conflictCount > 0 ? "CONFLICT" : ["GOOD", "WATCH", "LIMITED"].includes(horus.quality.sensorQuality) ? horus.quality.sensorQuality : "WATCH",
  });
  return true;
}


async function applyAs1ValidationCards(timeframe = validationTimeframe) {
  if (validationRequestPromise) {
    return validationRequestPromise;
  }

  validationRequestPromise = (async () => {
    try {
      if (!publicWeatherSnapshot) heroWeatherPhase = "loading";
      const client = await import("./as1-validation-client.js?v=10");
      validationTimeframe = timeframe;
      const nextCards = await client.fetchValidationCards({timeframe});
      const validPublicWeather = capturePublicWeatherSnapshot(nextCards, timeframe);
      heroWeatherPhase = validPublicWeather ? "valid" : "empty";
      validationCardsData = hasFeature("viewer.professional_details") ? nextCards : null;
      renderValidationCards();
      renderLynxDashboard();
      return validPublicWeather;
    } catch {
      if (!publicWeatherSnapshot) heroWeatherPhase = "empty";
      validationCardsData = null;
      renderValidationCards();
      renderLynxDashboard();
      return false;
    }
  })();

  try {
    return await validationRequestPromise;
  } finally {
    validationRequestPromise = null;
  }
}


function formatUpdatedAt(value) {
  const date = parseUpdatedAt(value);

  if (!date) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = {};

  parts.forEach((part) => {
    values[part.type] = part.value;
  });

  return `${values.year}. ${values.month}. ${values.day}. ` +
    `${values.hour}:${values.minute}`;
}


const MAAT_STATE_TEXT = [
  "균형",
  "상승 동기화",
  "하락 동기화",
  "충돌",
  "에너지 부족",
  "관측",
  "과열"
];

const TIME_ROLE_TEXT = [
  "없음",
  "부모 문맥",
  "초기 후보",
  "주인공 후보",
  "주인공 활성",
  "미세 확인",
  "거짓 해제",
  "노이즈",
  "리셋",
  "무효"
];

const TIME_WHY_TEXT = {
  0: "특이 사유 없음",
  10: "구조만 활성",
  20: "힘 형성",
  30: "시간창 형성",
  40: "구조·힘 동기화",
  41: "힘·시간창 동기화",
  42: "구조·시간창 동기화",
  50: "전체 동기화",
  61: "힘 약함",
  70: "위험 차단",
  80: "부모 타임프레임 불일치",
  81: "일부 source",
  82: "source 무효",
  90: "노이즈",
  91: "거짓 해제",
  92: "리셋"
};

function setValidationText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function formatValidationTfMinutes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  if (value % 1440 === 0) {
    return `${value / 1440}D`;
  }
  if (value % 60 === 0) {
    return `${value / 60}H`;
  }
  return `${value}M`;
}

function renderValidationQuality(id, observation) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  element.classList.remove(
    "quality-good",
    "quality-limited",
    "quality-watch",
    "quality-invalid"
  );
  if (!observation?.available) {
    element.textContent = tr("waiting");
    return;
  }
  const quality = observation.quality.sensorQuality;
  element.textContent = `${quality} · ${observation.freshness}`;
  element.classList.add(`quality-${quality.toLowerCase()}`);
}

function renderMaatValidationCard(observation) {
  renderValidationQuality("maatQuality", observation);
  if (!observation?.available) {
    setValidationText("maatStatus", tr("waiting"));
    for (const id of ["maatState", "maatScore", "maatRisk", "maatNoise", "maatSensors", "maatWindow", "maatUpdated"]) {
      setValidationText(id, "—");
    }
    return;
  }

  const payload = observation.payload;
  const aggregate = payload.aggregate || {};
  const stopwatch = payload.stopwatch || {};
  const sensors = payload.sensors && typeof payload.sensors === "object"
    ? Object.values(payload.sensors)
    : [];
  const validSensors = sensors.filter((sensor) => sensor?.valid === true).length;
  setValidationText("maatStatus", `${payload.record_status || "WATCH"} · 검증 결과는 PENDING으로 분리 기록됩니다.`);
  setValidationText("maatState", MAAT_STATE_TEXT[aggregate.state_code] || "확인 필요");
  setValidationText("maatScore", Number.isFinite(aggregate.score) ? Math.round(aggregate.score).toString() : "—");
  setValidationText("maatRisk", Number.isFinite(aggregate.risk_code) ? `R${aggregate.risk_code}` : "—");
  setValidationText("maatNoise", Number.isFinite(stopwatch.noise_score) ? stopwatch.noise_score.toString() : "—");
  setValidationText("maatSensors", `${validSensors}/6 유효 · 동기 ${aggregate.sync_count ?? "—"} · 충돌 ${aggregate.conflict_count ?? "—"}`);
  setValidationText("maatWindow", `${stopwatch.phase || "—"} · ${formatValidationTfMinutes(stopwatch.main_tf_minutes)} → ${formatValidationTfMinutes(stopwatch.parent_tf_minutes)}`);
  setValidationText("maatUpdated", formatUpdatedAt(observation.receivedAt) ? `${formatUpdatedAt(observation.receivedAt)} KST` : "시각 확인 불가");
}

function renderMaat2ValidationCard(maat2) {
  const time = maat2?.time;
  const hub = maat2?.hub;
  const primary = time?.available ? time : hub;
  renderValidationQuality("maat2Quality", primary);
  if (!primary?.available) {
    setValidationText("maat2Status", tr("waiting"));
    for (const id of ["maat2Role", "maat2TimeScore", "maat2Timeframes", "maat2Noise", "maat2HubScores", "maat2Why", "maat2Sync"]) {
      setValidationText(id, "—");
    }
    return;
  }

  const timePayload = time?.available ? time.payload : null;
  const hubPayload = hub?.available ? hub.payload : null;
  const timeState = timePayload?.time || {};
  const scores = hubPayload?.scores || timePayload?.scores || {};
  setValidationText("maat2Status", `${timePayload?.record_status || hubPayload?.record_status || "WATCH"} · 방향 예측과 HIT/MISS는 제공하지 않습니다.`);
  setValidationText("maat2Role", TIME_ROLE_TEXT[timeState.role_code] || "—");
  setValidationText("maat2TimeScore", Number.isFinite(timeState.score) ? timeState.score.toString() : "—");
  setValidationText("maat2Timeframes", `${formatValidationTfMinutes(timeState.candidate_tf_minutes)} / ${formatValidationTfMinutes(timeState.parent_tf_minutes)}`);
  setValidationText("maat2Noise", Number.isFinite(timeState.noise_score) ? timeState.noise_score.toString() : "—");
  setValidationText("maat2HubScores", `구조 ${Math.round(scores.structure ?? 0)} · 힘 ${Math.round(scores.force ?? 0)} · 창 ${Math.round(scores.window ?? 0)} · 위험 ${Math.round(scores.risk ?? 0)}`);
  setValidationText("maat2Why", `${TIME_WHY_TEXT[timeState.why_code] || "확인 필요"} · ${timeState.reset_flag ? "RESET" : "유지"}`);
  setValidationText("maat2Sync", hub?.available && time?.available ? (maat2.synchronized ? "같은 봉 확인" : "봉 시각 불일치") : "일부 패킷 대기");
}

function renderValidationCards() {
  if (!hasFeature("viewer.professional_details")) {
    const target = document.getElementById("validationCards");
    if (target) target.innerHTML = `<article class="validation-card card validation-locked"><p class="validation-kicker">프로 전용</p><h3>정밀 관측 도구</h3><p class="validation-status">정밀 관측 도구와 Mobile Viewer를 사용할 수 있습니다.</p><button type="button" data-open-plan data-plan-target="PRO">프로 보기</button></article>`;
    return;
  }
  renderMaatValidationCard(validationCardsData?.maat);
  renderMaat2ValidationCard(validationCardsData?.maat2);
}


function renderMarketPrice() {
  const price = document.getElementById("marketPrice");
  const meta = document.getElementById("marketPriceMeta");

  if (!price || !meta) {
    return;
  }

  if (selectedAssetId !== "BTCUSD") {
    if (!assetEntitled(selectedAssetId)) {
      price.textContent = "—";
      meta.textContent = `${tr("locked")} · ${planDisplayName(window.AiLynxAssetRegistry?.byId?.(selectedAssetId)?.requiredPlan || "WEATHER")}`;
      return;
    }
    const observed = currentAssetObservation()?.latestReceipt;
    price.textContent = Number.isFinite(observed?.barClose) ? formatPrice(observed.barClose) : "—";
    meta.textContent = observed ? tr("observedFreshness", {freshness: displayState(observed.freshness)}) : `${tr("currentPrice")} · ${tr("waiting")}`;
    return;
  }

  if (!marketPriceData?.available) {
    price.textContent = "—";
    meta.textContent = `${tr("oneMinuteUpdate")} · ${tr("waitingForData")}`;
    return;
  }

  price.textContent = formatPrice(marketPriceData.price);
  meta.textContent = marketPriceData.stale
    ? `COINBASE BTC-USD · ${tr("stale")}`
    : `COINBASE BTC-USD · ${tr("oneMinuteUpdate")}`;
}


async function refreshMarketPrice() {
  if (marketPriceRequestPromise) {
    return marketPriceRequestPromise;
  }

  marketPriceRequestPromise = (async () => {
    try {
      const priceClient = await import("./market-price-client.js?v=14");
      const result = await priceClient.fetchBtcSpotPrice();

      if (result.available) {
        marketPriceData = {...result, stale: false};
      } else if (marketPriceData?.available) {
        marketPriceData = {...marketPriceData, stale: true};
      } else {
        marketPriceData = null;
      }
    } catch {
      if (marketPriceData?.available) {
        marketPriceData = {...marketPriceData, stale: true};
      }
    }

    renderMarketPrice();
  })();

  try {
    return await marketPriceRequestPromise;
  } finally {
    marketPriceRequestPromise = null;
  }
}


function formatLocalClock(date = new Date()) {
  const twoDigits = (value) => String(value).padStart(2, "0");
  const time = `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;

  return window.matchMedia("(max-width: 760px)").matches
    ? `${time} KST`
    : `${date.getFullYear()}.${twoDigits(date.getMonth() + 1)}.${twoDigits(date.getDate())} · ${time}`;
}


function renderLocalClock() {
  const clock = document.getElementById("localClock");
  if (clock) {
    clock.textContent = formatLocalClock();
  }
}


function startLocalClock() {
  if (localClockIntervalId !== null) {
    return;
  }

  renderLocalClock();
  localClockIntervalId = window.setInterval(renderLocalClock, 60000);
  window.addEventListener("resize", () => {
    renderLocalClock();
    renderStatusBadge();
  });
}


function renderMarketDominance() {
  const strip = document.getElementById("marketDominanceStrip");
  const context = document.getElementById("marketDominanceContext");
  if (!strip || !context) {
    return;
  }

  const showForBitcoin = selectedAssetId === "BTCUSD";
  context.hidden = !showForBitcoin;
  strip.replaceChildren();
  if (!showForBitcoin) return;
  const values = marketDominanceData?.available
    ? marketDominanceData.values
    : ["BTC.D", "USDT.D", "USDC.D"].map((label) => ({label, value: null}));

  values.forEach((item) => {
    const card = document.createElement("article");
    card.className = "dominance-card";
    card.dataset.source = marketDominanceData?.source || "UNAVAILABLE";
    const label = document.createElement("span");
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = Number.isFinite(item.value) ? `${item.value.toFixed(1)}%` : "—";
    const occupancy = document.createElement("span");
    occupancy.className = "dominance-occupancy";
    const fill = document.createElement("i");
    fill.style.setProperty("--dominance-value", `${Number.isFinite(item.value) ? item.value : 0}%`);
    occupancy.appendChild(fill);
    const status = document.createElement("small");
    status.textContent = marketDominanceData?.available
      ? marketDominanceData.stale
        ? `${tr("free")} · ${tr("stale")}`
        : marketDominanceData.source === "AS1 VALID RECEIPT"
          ? `${tr("free")} · ${tr("liveObservation")}`
          : `${tr("free")} · ${tr("publicData")}`
      : "관측 대기";
    card.append(label, value, occupancy, status);
    strip.appendChild(card);
  });
}


async function refreshMarketDominance() {
  if (marketDominanceRequestPromise) {
    return marketDominanceRequestPromise;
  }

  marketDominanceRequestPromise = (async () => {
    try {
      const dominanceClient = await import("./market-dominance-client.js?v=15");
      const result = await dominanceClient.fetchMarketDominance();
      if (result.available) {
        marketDominanceData = {...result, stale: false};
      } else if (marketDominanceData?.available) {
        marketDominanceData = {...marketDominanceData, stale: true};
      }
    } catch {
      if (marketDominanceData?.available) {
        marketDominanceData = {...marketDominanceData, stale: true};
      }
    }

    renderMarketDominance();
  })();

  try {
    return await marketDominanceRequestPromise;
  } finally {
    marketDominanceRequestPromise = null;
  }
}


function renderVisitStats() {
  const target = document.getElementById("visitStats");
  if (!target) {
    return;
  }

  if (!visitStatsData?.available) {
    target.textContent = tr("totalVisitsWaiting");
    return;
  }

  const formatter = new Intl.NumberFormat("en-US");
  target.textContent = tr("totalVisits", {total: formatter.format(visitStatsData.totalVisits), today: formatter.format(visitStatsData.todayVisits)});
}


async function refreshVisitStats() {
  if (visitStatsRequestPromise) {
    return visitStatsRequestPromise;
  }

  visitStatsRequestPromise = (async () => {
    try {
      const visitClient = await import("./visit-counter-client.js?v=15");
      let sessionRecorded = false;
      try {
        sessionRecorded = window.sessionStorage.getItem(visitClient.PWA_VISIT_SESSION_KEY) === "1";
      } catch {
        sessionRecorded = false;
      }

      const result = await visitClient.fetchVisitStats({method: sessionRecorded ? "GET" : "POST"});
      if (result.available) {
        visitStatsData = result;
        if (!sessionRecorded) {
          try {
            window.sessionStorage.setItem(visitClient.PWA_VISIT_SESSION_KEY, "1");
          } catch {
            // The count remains functional if browser storage is unavailable.
          }
        }
      }
    } catch {
      // The footer remains in its explicit WAITING state until the public counter is reachable.
    }

    renderVisitStats();
  })();

  try {
    return await visitStatsRequestPromise;
  } finally {
    visitStatsRequestPromise = null;
  }
}

function dashboardText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function subscriptionPlanCode() {
  const membership = window.AiLynxMembership?.membership?.() || window.AiLynxAuthGate?.state?.();
  const code = String(membership?.plan || "FREE").toUpperCase();
  return dashboardConfig?.plans?.[code] ? code : "FREE";
}

function currentPlanCode() {
  const subscriptionPlan = subscriptionPlanCode();
  const previewPlan = window.AiLynxAdminPreview?.effectivePlan?.(subscriptionPlan);
  return dashboardConfig?.plans?.[previewPlan] ? previewPlan : subscriptionPlan;
}

function currentPlan() {
  return dashboardConfig?.plans?.[currentPlanCode()] ?? dashboardConfig?.plans?.FREE ?? null;
}

function planDisplayName(code = currentPlanCode()) {
  return dashboardConfig?.plans?.[code]?.label || dashboardConfig?.plans?.FREE?.label || "무료";
}

function planAtLeast(code) {
  const requiredRank = dashboardConfig?.plans?.[code]?.rank;
  return Number.isFinite(requiredRank) && (currentPlan()?.rank || 0) >= requiredRank;
}

function hasFeature(feature) {
  return Boolean(currentPlan()?.features?.includes(feature));
}

function assetEntitled(assetId) {
  const requiredPlan = window.AiLynxAssetRegistry?.byId?.(assetId)?.requiredPlan;
  return Boolean(requiredPlan && planAtLeast(requiredPlan));
}

function currentAssetObservation() {
  return assetEntitled(selectedAssetId) ? selectedAssetObservation : null;
}

async function selectAsset(assetId) {
  if (!assetReadPath) {
    assetReadPathPromise ??= import("./asset-read-path.js?v=2").then((readPath) => {
      assetReadPath = readPath.createAssetReadPath({
        canReadAsset: assetEntitled,
        fetchObservation: async ({asset, signal}) => {
          const client = await import("./as1-asset-client.js?v=2");
          return client.fetchAssetObservations({asset, signal});
        },
        onChange: (selection) => {
          selectedAssetId = selection.assetId;
          selectedAssetObservation = selection.observation;
          if (document.readyState !== "loading") renderLynxDashboard();
        },
      });
      return assetReadPath;
    });
    await assetReadPathPromise;
  }
  return assetReadPath.select(assetId);
}

function weatherPresentation(score) {
  if (!Number.isFinite(score)) return heroWeatherPhase === "loading"
    ? {iconCode: "LOADING", label: "불러오는 중", note: "유효 관측을 확인하고 있습니다."}
    : {iconCode: "WAITING", label: "관측 준비 중", note: "유효 관측을 기다리는 중"};
  const band = dashboardConfig?.weatherBands?.find((item) => score >= item.min && score <= item.max);
  return band ? {...band, iconCode: band.icon, label: displayState(band.label), note: tr("liveData")} : {iconCode: "WAITING", label: tr("noData"), note: tr("publicContractWaiting")};
}

function observedHeroState() {
  if (selectedAssetId !== "BTCUSD") {
    const selected = currentAssetObservation();
    const latest = selected?.latestReceipt;
    return {timeframe: latest?.timeframe || "WAITING", state: selected?.status || (assetEntitled(selectedAssetId) ? "WAITING" : "LOCKED")};
  }
  const publicWeather = publicWeatherSnapshot;
  return {
    timeframe: publicWeather?.leaderTimeframe || "WAITING",
    state: publicWeather ? "LIVE" : "WAITING",
  };
}

function planAllows(timeframe, kind) {
  const plan = currentPlan();
  return Boolean(plan && plan[kind]?.includes(timeframe));
}

function requiredPlanForTimeframe(timeframe, kind) {
  // Daily access is a product policy, not an inferred rank: 1D is the
  // Plus entry point, while every higher daily horizon is Premium.
  if (kind === "daily") return timeframe === "1D" ? "WEATHER" : "PREMIUM";
  return ["FREE", "WEATHER", "PREMIUM", "PRO"].find((planCode) => dashboardConfig?.plans?.[planCode]?.[kind]?.includes(timeframe)) || "PRO";
}

function makeFrameCell(timeframe, kind) {
  const allowed = planAllows(timeframe, kind);
  const requiredPlan = requiredPlanForTimeframe(timeframe, kind);
  const canonical = timeframe === "24H" ? "1D" : timeframe;
  const selected = allowed ? currentAssetObservation() : null;
  const observation = allowed ? (selectedAssetId === "BTCUSD" ? horusSnapshot?.timeframes?.[canonical] : selected?.timeframes?.[canonical]) : null;
  const status = !allowed ? "LOCKED" : selectedAssetId !== "BTCUSD"
    ? !assetEntitled(selectedAssetId) ? "LOCKED"
      : !selected ? "WAITING"
      : selected.status === "PLANNED" ? "PLANNED"
      : selected.status === "INVALID" ? "INVALID"
      : !observation ? "NO DATA"
      : observation.sensorQuality === "INVALID" ? "INVALID" : observation.freshness
    : !horusSnapshot ? "WAITING"
      : !observation?.available ? observation?.reason === "INVALID_OBSERVATION" ? "INVALID" : "NO DATA"
      : !observation.quality.valid || observation.quality.sensorQuality === "INVALID" ? "INVALID"
      : observation.freshness;
  const cell = document.createElement("article");
  cell.className = `frame-cell ${allowed ? `is-${status.toLowerCase().replace(" ", "-")}` : "is-locked"}`;
  const label = document.createElement("strong");
  label.textContent = timeframe === "24H" ? "24H / 1D" : timeframe;
  const icon = document.createElement("span");
  icon.className = "frame-icon";
  icon.textContent = !allowed ? "" : status === "FRESH" || status === "AGING" ? "●" : status === "STALE" ? "◐" : status === "INVALID" ? "!" : status === "NO DATA" ? "—" : "◌";
  const persistence = document.createElement("small");
  if (allowed) persistence.textContent = displayState(status);
  else {
    persistence.className = "frame-entitlement";
    persistence.append(createPlanLockIcon(), document.createTextNode(planDisplayName(requiredPlan)));
  }
  const change = document.createElement("small");
  change.className = "frame-change";
  change.textContent = !allowed ? "" : selectedAssetId !== "BTCUSD" && observation ? `${observation.sensorQuality} · LIVE`
    : observation?.available ? `${observation.quality.sensorQuality} · ${observation.quality.valid ? "LIVE" : "INVALID"}`
      : tr("waiting");
  cell.append(label, icon, persistence, change);
  return cell;
}

function renderAssetNavigation() {
  const container = document.getElementById("assetNavigation");
  if (!container || !dashboardConfig) return;
  container.replaceChildren();
  const assets = window.AiLynxAssetRegistry?.assets || [];
  for (const asset of assets) {
    const allowed = assetEntitled(asset.id);
    const item = document.createElement("button");
    item.type = "button";
    item.className = `asset-navigation-item ${allowed ? "is-live" : "is-locked"} ${asset.id === selectedAssetId ? "is-selected" : ""}`;
    item.setAttribute("aria-current", String(asset.id === selectedAssetId));
    item.setAttribute("aria-label", allowed ? `${asset.label} ${asset.id}` : `${asset.label} ${asset.id}, ${planDisplayName(asset.requiredPlan)} 필요`);
    const name = document.createElement("strong");
    name.textContent = asset.label;
    const identity = document.createElement("small");
    identity.textContent = asset.id;
    const access = document.createElement("span");
    access.className = "asset-navigation-access";
    if (allowed) access.textContent = asset.id === "BTCUSD" ? "실시간" : tr("available");
    else access.append(createPlanLockIcon(), document.createTextNode(planDisplayName(asset.requiredPlan)));
    item.append(name, identity, access);
    item.addEventListener("click", () => {
      if (!allowed) {
        window.AiLynxAuthGate?.requestAssetAccess?.(asset);
        return;
      }
      void selectAsset(asset.id);
    });
    container.appendChild(item);
  }
}

function hideLegacyWeatherPanels() {
  for (const selector of [".hourly-card", ".daily-card"]) {
    document.querySelector(selector)?.closest(".section")?.setAttribute("hidden", "");
  }
  document.querySelector(".info-grid")?.setAttribute("hidden", "");
}

function renderLynxDashboard() {
  if (!dashboardConfig) return;
  const result = currentWeatherEngineResult();
  const observationHistory = recordWeatherObservation(result);
  const durability = window.AiLynxWeatherEngine?.computeDurability?.(observationHistory);
  const changeRate = window.AiLynxWeatherEngine?.computeChangeRate?.(observationHistory);
  const classified = window.AiLynxWeatherEngine?.classifyWeather?.(result?.score);
  const presentation = classified ? {iconCode: classified.icon, label: displayState(classified.state), note: tr("fullObservation", {timeframe: result.timeframe}), score: result.score} : weatherPresentation(null);
  document.body.classList.remove("weather--sunny", "weather--partly-cloudy", "weather--cloudy", "weather--rain", "weather--neutral");
  document.body.classList.add(classified ? `weather--${classified.state.toLowerCase().replace("_", "-")}` : "weather--neutral");
  const hero = observedHeroState();
  const asset = window.AiLynxAssetRegistry?.byId?.(selectedAssetId);
  const heroLabel = document.getElementById("heroAssetLabel");
  if (heroLabel) heroLabel.textContent = `${asset?.label || selectedAssetId} · ${tr("lynxWeather")}`;
  const identity = document.getElementById("heroAssetIdentity");
  if (identity && asset) {
    identity.textContent = asset.id === "BTCUSD"
      ? "Coinbase BTC-USD · 1분 갱신"
      : assetEntitled(asset.id)
        ? `${asset.id} · 관측 데이터 확인 중`
        : `${asset.id} · ${planDisplayName(asset.requiredPlan)} 필요`;
  }
  renderWeatherIcon(presentation.iconCode);
  dashboardText("heroWeatherName", presentation.label);
  dashboardText("heroWeatherScore", Number.isFinite(presentation.score) ? String(presentation.score) : "—");
  dashboardText("heroWeatherNote", presentation.note);
  const heroPanel = document.querySelector(".hero-weather-panel");
  if (heroPanel) heroPanel.dataset.state = Number.isFinite(presentation.score) ? "valid" : heroWeatherPhase;
  renderCoreMetrics(durability, changeRate, hero);
  renderMarketPrice();

  const daily = document.getElementById("dailyFrameStrip");
  if (daily) {
    daily.replaceChildren();
    dashboardConfig.dailyTimeframes.forEach((timeframe) => daily.appendChild(makeFrameCell(timeframe, "daily")));
  }
  const intraday = document.getElementById("timeframeMatrix");
  if (intraday) {
    intraday.replaceChildren();
    dashboardConfig.intradayTimeframes.forEach((timeframe) => intraday.appendChild(makeFrameCell(timeframe, "intraday")));
  }
  renderAssetNavigation();
  renderMarketDominance();
}


function getExpectedUpdateMinutes() {
  const value =
    weatherData.dataMeta?.expectedUpdateMinutes;

  return typeof value === "number" &&
    Number.isFinite(value) && value > 0
    ? value
    : 60;
}


function getElapsedMinutes(value) {
  const date = parseUpdatedAt(value);

  if (!date) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000)
  );
}


function formatElapsedTime(minutes) {
  if (!Number.isFinite(minutes) || minutes < 1) {
    return window.AiLynxI18n?.language === "ko" ? "방금 전" : "just now";
  }

  const totalMinutes = Math.floor(minutes);

  if (totalMinutes < 60) {
    return window.AiLynxI18n?.language === "ko" ? `${totalMinutes}분 전` : `${totalMinutes}m ago`;
  }

  if (totalMinutes < 1440) {
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    if (window.AiLynxI18n?.language === "ko") return remainingMinutes ? `${hours}시간 ${remainingMinutes}분 전` : `${hours}시간 전`;
    return remainingMinutes ? `${hours}h ${remainingMinutes}m ago` : `${hours}h ago`;
  }

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);

  if (window.AiLynxI18n?.language === "ko") return hours ? `${days}일 ${hours}시간 전` : `${days}일 전`;
  return hours ? `${days}d ${hours}h ago` : `${days}d ago`;
}


function getFreshnessStatus() {
  const elapsedMinutes =
    getElapsedMinutes(weatherData.updatedAt);

  if (!navigator.onLine) {
    return {
      status: "offline",
      text: elapsedMinutes === null
        ? "● OFFLINE CACHE · LAST OBSERVATION TIME UNAVAILABLE"
        : `● OFFLINE CACHE · LAST OBSERVATION ${formatElapsedTime(elapsedMinutes)}`
    };
  }

  if (elapsedMinutes === null) {
    return { status: "error", text: "● DATA ERROR" };
  }

  if (
    weatherData.mode === "AS1_LIVE" &&
    weatherData.as1Live
  ) {
    const receivedAt =
      parseUpdatedAt(weatherData.updatedAt);
    const ageSeconds = receivedAt
      ? Math.max(
        0,
        Math.floor(
          (Date.now() - receivedAt.getTime()) / 1000
        )
      )
      : null;
    let liveState =
      weatherData.as1Live.freshness;

    if (ageSeconds !== null) {
      let elapsedState;

      if (ageSeconds <= 4.5 * 60 * 60) {
        elapsedState = "FRESH";
      } else if (ageSeconds <= 8.5 * 60 * 60) {
        elapsedState = "AGING";
      } else if (ageSeconds <= 24 * 60 * 60) {
        elapsedState = "STALE";
      } else {
        elapsedState = "EXPIRED";
      }

      const freshnessRank = {
        FRESH: 0,
        AGING: 1,
        STALE: 2,
        EXPIRED: 3
      };

      if (
        freshnessRank[elapsedState] >
        freshnessRank[liveState]
      ) {
        liveState = elapsedState;
      }
    }

    const liveStatus = {
      FRESH: "fresh",
      AGING: "delay",
      STALE: "stale",
      EXPIRED: "expired"
    }[liveState] || "error";

    return {
      status: liveStatus,
      text:
        `● LIVE DATA · ${liveState} · ${formatElapsedTime(elapsedMinutes)}`
    };
  }

  const expectedMinutes = getExpectedUpdateMinutes();

  if (elapsedMinutes <= expectedMinutes) {
    return {
      status: "fresh",
      text: weatherData.mode === "SAMPLE"
        ? `● SAMPLE DATA · ${formatElapsedTime(elapsedMinutes)}`
        : `● LIVE DATA · ${formatElapsedTime(elapsedMinutes)}`
    };
  }

  if (elapsedMinutes <= expectedMinutes * 2) {
    return { status: "delay", text: `● DATA DELAY · ${formatElapsedTime(elapsedMinutes)}` };
  }

  if (elapsedMinutes <= expectedMinutes * 4) {
    return { status: "stale", text: `● STALE DATA · ${formatElapsedTime(elapsedMinutes)}` };
  }

  return {
    status: "expired",
    text: `● DATA EXPIRED · ${formatElapsedTime(elapsedMinutes)}`
  };
}


function renderStatusBadge() {
  const badge =
    document.querySelector(".live-badge");

  if (!badge) {
    return;
  }

  const freshness = getFreshnessStatus();

  badge.classList.remove(...STATUS_CLASSES);
  badge.classList.add(`status-${freshness.status}`);
  if (window.matchMedia("(max-width: 390px)").matches) {
    const compactText = {
      fresh: "● LIVE · FRESH",
      delay: "● LIVE · AGING",
      stale: "● LIVE · STALE",
      expired: "● LIVE · EXPIRED",
      offline: "● OFFLINE",
      error: "● DATA ERROR",
    };
    badge.textContent = compactText[freshness.status] || freshness.text;
    return;
  }

  badge.textContent = freshness.text;
}


/*
  현재 날씨
*/
function renderCurrentWeather() {
  const priceElement =
    document.querySelector(".price");

  const changeElement =
    document.querySelector(".price-change");

  const headlineElement =
    document.querySelector(".headline");

  const weatherIconElement =
    document.querySelector(".weather-icon");

  const weatherNameElement =
    document.querySelector(".weather-name");

  const energyElement =
    document.querySelector(".energy");

  if (
    !priceElement ||
    !changeElement ||
    !headlineElement ||
    !weatherIconElement ||
    !weatherNameElement ||
    !energyElement
  ) {
    return;
  }

  priceElement.textContent =
    formatPrice(weatherData.price);

  const change =
    Number(weatherData.priceChange) || 0;

  const sign =
    change >= 0 ? "+" : "";

  changeElement.textContent =
    `${sign}${change.toFixed(2)}% · 24시간`;

  headlineElement.textContent =
    weatherData.headline;

  weatherIconElement.textContent =
    getWeatherIcon(
      weatherData.weather.icon
    );

  weatherNameElement.textContent =
    weatherData.weather.name;

  energyElement.textContent =
    Number.isFinite(weatherData.weather.energy)
      ? `현재 시장 에너지 ${weatherData.weather.energy}°`
      : "현재 시장 에너지 산정 대기";
}


/*
  시간축별 날씨
*/
function renderHourlyWeather() {
  const container =
    document.querySelector(".hourly-list");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const hourlyData =
    Array.isArray(weatherData.hourly)
      ? weatherData.hourly
      : [];

  hourlyData.forEach((data) => {
    const card =
      document.createElement("article");

    card.className = "hour";

    card.innerHTML = `
      <div class="hour-time">
        ${data.time}
      </div>

      <div class="hour-icon">
        ${getWeatherIcon(data.icon)}
      </div>

      <div class="hour-energy">
        ${data.energy}°
      </div>

      <div class="hour-rain">
        💧 ${data.probability}%
      </div>
    `;

    container.appendChild(card);
  });
}


/*
  상위 시간축 예보
*/
function renderDailyForecast() {
  const container =
    document.querySelector("#dailyForecast");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const dailyData =
    Array.isArray(weatherData.daily)
      ? weatherData.daily
      : [];

  dailyData.forEach((data) => {
    const row =
      document.createElement("article");

    row.className = "daily-row";

    row.innerHTML = `
      <div class="daily-day">
        ${data.day}
      </div>

      <div>
        <span class="daily-timeframe">
          ${data.timeframe}
        </span>
      </div>

      <div class="daily-status">
        <span class="daily-icon">
          ${getWeatherIcon(data.icon)}
        </span>

        <span class="daily-status-text">
          <span class="daily-status-name">
            ${data.status}
          </span>

          <span class="daily-status-note">
            ${data.note}
          </span>
        </span>
      </div>

      <div class="daily-probability">
        💧 ${data.probability}%
      </div>

      <div class="daily-range">
        ${data.upperEnergy}° /
        ${data.lowerEnergy}°
      </div>
    `;

    container.appendChild(row);
  });
}


/*
  핵심 정보 카드
*/
function renderInfoCards() {
  const infoValues =
    document.querySelectorAll(
      ".info-value"
    );

  const infoDescriptions =
    document.querySelectorAll(
      ".info-description"
    );

  if (
    infoValues.length < 3 ||
    infoDescriptions.length < 3
  ) {
    return;
  }

  infoValues[0].textContent =
    formatTimeframe(
      weatherData.mainTimeframe
    );

  infoValues[1].textContent =
    weatherData.nextCheck;

  infoValues[2].textContent =
    weatherData.watchLevel.text;

  infoDescriptions[2].textContent =
    weatherData.watchLevel.description;

  infoValues[2].classList.remove(
    "safe"
  );

  if (
    weatherData.watchLevel.level ===
    "LOW"
  ) {
    infoValues[2].classList.add(
      "safe"
    );
  }
}


/*
  전체 화면 표시
*/
function renderLastUpdated() {
  const footerFirstLine =
    document.getElementById("lastObservation");

  if (!footerFirstLine) {
    return;
  }

  const updatedAt =
    formatUpdatedAt(weatherData.updatedAt);

  if (!updatedAt) {
    footerFirstLine.textContent =
      tr("lastObservationUnavailable");

    return;
  }

  footerFirstLine.textContent =
    tr("lastObservation", {time: updatedAt, elapsed: formatElapsedTime(getElapsedMinutes(weatherData.updatedAt))});
}


function renderApp() {
  renderStatusBadge();
  renderCurrentWeather();
  renderHourlyWeather();
  renderDailyForecast();
  renderInfoCards();
  renderLastUpdated();
  renderValidationCards();
  renderLynxDashboard();
}


function refreshFreshnessDisplay() {
  renderStatusBadge();
  renderLastUpdated();
}


function startFreshnessTimer() {
  if (freshnessIntervalId !== null) {
    return;
  }

  freshnessIntervalId = window.setInterval(
    refreshFreshnessDisplay,
    60000
  );
}


function startMarketPriceTimer() {
  if (marketPriceIntervalId !== null) {
    return;
  }

  marketPriceIntervalId = window.setInterval(refreshMarketPrice, 60000);
}


function startMarketDominanceTimer() {
  if (marketDominanceIntervalId !== null) {
    return;
  }

  marketDominanceIntervalId = window.setInterval(refreshMarketDominance, 10 * 60 * 1000);
}

function currentWeatherEngineResult() {
  return selectedAssetId === "BTCUSD" ? publicWeatherSnapshot?.result ?? null : null;
}

function initializeAnnouncementTicker() {
  const target = document.getElementById("announcementTicker");
  const notices = Array.isArray(window.LynxNotices) ? window.LynxNotices.filter((item) => typeof item === "string" && item.trim()) : [];
  if (!target || notices.length === 0) return;
  const message = notices.join(" · ");
  const primary = document.createElement("span");
  primary.textContent = message;
  const copy = primary.cloneNode(true);
  copy.setAttribute("aria-hidden", "true");
  target.replaceChildren(primary, copy);
  target.closest(".announcement-ticker")?.addEventListener("pointerdown", () => {
    target.closest(".announcement-ticker")?.classList.toggle("is-paused");
  });
}


function initializeTabs() {
  const tabs = document.querySelectorAll("[data-tab]");
  const panels = document.querySelectorAll("[data-tab-panel]");

  const selectTab = (selectedTab) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === selectedTab;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== selectedTab;
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  });
}


function initializeInquiryStatus() {
  const inquiry = document.querySelector("[data-inquiry-status]");
  if (!inquiry) {
    return;
  }

  inquiry.addEventListener("click", () => {
    inquiry.textContent = "고객문의 준비 중";
    inquiry.setAttribute("aria-label", "고객문의 준비 중");
  });
}

function initializeBrandMark() {
  const mark = document.getElementById("brandMark");
  const fallback = document.getElementById("brandFallback");
  if (!mark || !fallback) return;
  const showFallback = () => {
    mark.hidden = true;
    fallback.hidden = false;
  };
  mark.addEventListener("error", showFallback, {once: true});
  if (mark.complete && mark.naturalWidth === 0) showFallback();
}

function initializeCoreDynamicsHelp() {
  document.getElementById("coreDynamicsHelp")?.addEventListener("click", () => {
    document.getElementById("manualDialog")?.showModal();
  });
}


/*
  앱 시작
*/
async function initializeApp() {
  hideLegacyWeatherPanels();
  initializeBrandMark();
  initializeAnnouncementTicker();
  initializeTabs();
  initializeInquiryStatus();
  initializeCoreDynamicsHelp();
  startLocalClock();
  if (!liveFetchAllowed()) {
    renderApp();
    void refreshVisitStats();
    return;
  }
  await loadWeatherData();
  await applyConfiguredOverlay();
  renderApp();
  startFreshnessTimer();
  startMarketPriceTimer();
  startMarketDominanceTimer();
  void refreshMarketPrice();
  void refreshMarketDominance();
  void refreshVisitStats();
  await applyAs1ValidationCards(validationTimeframe);

  const selector = document.getElementById("validationTimeframe");
  if (selector) {
    selector.addEventListener("change", async (event) => {
      validationCardsData = null;
      renderValidationCards();
      await applyAs1ValidationCards(event.target.value);
    });
  }
}

function recordWeatherObservation(result) {
  if (selectedAssetId !== "BTCUSD" || !result) return null;
  const publicWeather = publicWeatherSnapshot;
  const receipt = publicWeather?.receipt;
  const freshness = receipt?.freshness;
  if (!receipt || receipt.quality?.valid !== true || !["FRESH", "AGING"].includes(freshness)) return null;
  const classified = window.AiLynxWeatherEngine?.classifyWeather?.(result.score);
  if (!classified) return null;
  const snapshot = Object.freeze({
    assetId: selectedAssetId,
    timeframe: result.timeframe,
    majorTimeframe: publicWeather.leaderTimeframe || result.timeframe,
    score: result.score,
    state: classified.state,
    valid: true,
    noise: publicWeather.noise,
    quality: publicWeather.quality,
    freshness,
    observedAt: receipt.receivedAt,
  });
  const key = `${snapshot.assetId}:${snapshot.timeframe}`;
  const historyClient = window.AiLynxWeatherHistory;
  const history = weatherObservationHistory.get(key) || historyClient?.readWeatherHistory?.(window.localStorage, snapshot.assetId, snapshot.timeframe) || [];
  const bounded = historyClient?.mergeWeatherHistory?.(history, snapshot) || (() => {
    const next = [...history];
    const index = next.findIndex((item) => item.observedAt === snapshot.observedAt);
    if (index >= 0) next[index] = snapshot;
    else next.push(snapshot);
    return next.slice(-4);
  })();
  weatherObservationHistory.set(key, bounded);
  historyClient?.writeWeatherHistory?.(window.localStorage, bounded);
  return bounded;
}

function leaderTimeframe(hero = observedHeroState()) {
  const supported = ["1H", "4H", "6H", "8H", "12H", "1D", "24H"];
  return selectedAssetId === "BTCUSD" && currentWeatherEngineResult() && supported.includes(hero?.timeframe) ? hero.timeframe : "—";
}

function coreMetricPresentation(value, kind, observationCount) {
  return window.AiLynxCoreDynamics?.metricPresentation?.(value, kind, observationCount) || {ready: false, value: null, band: "관측 축적 중", note: `관측 ${observationCount > 0 ? 1 : 0} / 2 · 유효 관측이 쌓이면 표시합니다.`};
}

function setCoreMetricGauge(id, value) {
  const element = document.getElementById(id);
  if (element) element.style.setProperty("--core-metric-value", `${Number.isFinite(value) ? value : 0}%`);
}

function updateCoreMetric(cardId, valueId, bandId, noteId, gaugeId, presentation) {
  const card = document.getElementById(cardId);
  const previous = coreDynamicsValues.get(cardId);
  const next = presentation.value;
  const changed = window.AiLynxCoreDynamics?.hasCoreTransition?.(previous, next) ?? (previous !== undefined && previous !== next);
  coreDynamicsValues.set(cardId, next);
  dashboardText(valueId, presentation.ready ? String(presentation.value) : "—");
  dashboardText(bandId, presentation.band);
  dashboardText(noteId, presentation.note);
  const note = document.getElementById(noteId);
  if (note) note.hidden = presentation.ready;
  setCoreMetricGauge(gaugeId, presentation.value);
  if (!card) return;
  card.dataset.state = presentation.ready ? "ready" : "accumulating";
  card.dataset.level = !presentation.ready ? "accumulating" : presentation.value >= 80 ? "very-high" : presentation.value >= 60 ? "high" : presentation.value >= 40 ? "mid" : presentation.value >= 20 ? "low" : "very-low";
  if (!changed) return;
  card.classList.remove("is-updated");
  void card.offsetWidth;
  card.classList.add("is-updated");
  window.setTimeout(() => card.classList.remove("is-updated"), 520);
}

function updateLeaderTimeframe(value, allowed) {
  const card = document.getElementById("coreLeaderMetric");
  const lock = document.getElementById("coreLeaderLock");
  const note = document.getElementById("coreLeaderNote");
  const cta = document.getElementById("coreLeaderCta");
  const previous = coreDynamicsValues.get("leader");
  const next = allowed ? value : null;
  const changed = window.AiLynxCoreDynamics?.hasCoreTransition?.(previous, next) ?? (previous !== undefined && previous !== next);
  coreDynamicsValues.set("leader", next);
  dashboardText("coreLeaderTimeframe", allowed ? value : planDisplayName("WEATHER"));
  if (lock) lock.hidden = allowed;
  if (note) note.hidden = allowed;
  if (cta) cta.hidden = allowed;
  if (!card) return;
  card.dataset.state = allowed ? (value === "—" ? "empty" : "ready") : "locked";
  card.toggleAttribute("data-locked", !allowed);
  if (!changed) return;
  card.classList.remove("is-updated");
  void card.offsetWidth;
  card.classList.add("is-updated");
  window.setTimeout(() => card.classList.remove("is-updated"), 520);
}

function renderCoreMetrics(durability, changeRate, hero) {
  const history = weatherObservationHistory.get(`BTCUSD:${weatherTimeframeLabel()}`);
  const observationCount = Array.isArray(history) ? history.length : 0;
  updateCoreMetric("corePersistenceMetric", "corePersistence", "corePersistenceBand", "corePersistenceNote", "corePersistenceGauge", coreMetricPresentation(durability, "persistence", observationCount));
  updateCoreMetric("coreChangeMetric", "coreChange", "coreChangeBand", "coreChangeNote", "coreChangeGauge", coreMetricPresentation(changeRate, "changeRate", observationCount));
  const leaderAllowed = planAtLeast("WEATHER");
  const leader = leaderAllowed ? (window.AiLynxCoreDynamics?.leaderPresentation?.(leaderTimeframe(hero))?.value || "—") : "—";
  updateLeaderTimeframe(leader, leaderAllowed);
}

window.addEventListener("ailynx-member-preferences", async (event) => {
  const next = event.detail?.mainAsset;
  if (!assetEntitled(next)) return;
  void selectAsset(next);
});


/*
  온라인·오프라인 변화 감지
*/
window.addEventListener(
  "online",
  async () => {
    if (!liveFetchAllowed()) return;
    if (APP_DATA_MODE === "AS1_LIVE") {
      await applyAs1LiveOverlay();
    } else {
      await loadWeatherData();
      await applyConfiguredOverlay();
    }

    await applyAs1ValidationCards(validationTimeframe);

    renderApp();
    void refreshMarketPrice();
    void refreshMarketDominance();
    void refreshVisitStats();
  }
);

window.addEventListener(
  "offline",
  () => {
    refreshFreshnessDisplay();
  }
);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    renderLocalClock();
    if (!liveFetchAllowed()) return;
    void refreshMarketPrice();
    void refreshMarketDominance();
  }
});


document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);

window.addEventListener("ailynx-language", () => {
  const plan = currentPlan();
  dashboardText("currentPlanLabel", tr("currentPlan", {plan: plan?.label || "FREE"}));
  if (document.readyState !== "loading") {
    renderApp();
  }
});

async function enforceFreeSafeSelection() {
  if (assetEntitled(selectedAssetId)) return;
  selectedAssetId = "BTCUSD";
  selectedAssetObservation = null;
  if (assetReadPath) await assetReadPath.select("BTCUSD");
}

window.addEventListener("ailynx-membership", () => {
  void enforceFreeSafeSelection();
  assetReadPath?.reconcileAccess?.();
  if (!hasFeature("viewer.professional_details")) validationCardsData = null;
  const plan = currentPlan();
  dashboardText("currentPlanLabel", tr("currentPlan", {plan: plan?.label || currentPlanCode()}));
  if (document.readyState !== "loading") {
    renderApp();
  }
});

window.addEventListener("ailynx-admin-preview", () => {
  void enforceFreeSafeSelection();
  assetReadPath?.reconcileAccess?.();
  if (!hasFeature("viewer.professional_details")) validationCardsData = null;
  if (document.readyState !== "loading") renderApp();
});

window.addEventListener("ailynx-auth-logout", () => {
  selectedAssetObservation = null;
  validationCardsData = null;
  void enforceFreeSafeSelection();
});


/*
  서비스 워커 등록
*/
if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    async () => {
      try {
        const registration =
          await navigator.serviceWorker.register(
            "./service-worker.js"
          );

        console.log(
          "AiLynx 서비스 워커 등록 성공:",
          registration.scope
        );
      } catch (error) {
        console.error(
          "AiLynx 서비스 워커 등록 실패:",
          error
        );
      }
    }
  );
}

