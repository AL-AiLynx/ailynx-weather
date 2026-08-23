"use strict";

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
let as1LiveRequestPromise = null;

const STATUS_CLASSES = [
  "status-fresh",
  "status-delay",
  "status-stale",
  "status-expired",
  "status-offline",
  "status-error"
];


/*
  날씨 코드 → 이모지
*/
const WEATHER_ICONS = {
  SUNNY: "☀️",
  PARTLY_CLOUDY: "🌤️",
  MOSTLY_CLOUDY: "⛅",
  CLOUDY: "☁️",
  SHOWERS: "🌦️",
  RAIN: "🌧️",
  STORM: "⛈️",
  FOG: "🌫️",
  WIND: "💨",
  HOT: "🔥",
  COLD: "❄️"
};


function getWeatherIcon(iconCode) {
  return WEATHER_ICONS[iconCode] || "☁️";
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


async function applyAs1LiveOverlay() {
  if (APP_DATA_MODE !== "AS1_LIVE") {
    return false;
  }

  if (as1LiveRequestPromise) {
    return as1LiveRequestPromise;
  }

  as1LiveRequestPromise = (async () => {
    try {
      const liveClient = await import(
        "./as1-live-client.js"
      );
      const result = await liveClient
        .fetchAs1LiveObservation();

      if (!result.applied) {
        console.warn(
          "AiLynx AS1 Live 데이터 미적용:",
          result.reason
        );
        return false;
      }

      weatherData = {
        ...weatherData,
        mode: "AS1_LIVE",
        price: result.price,
        updatedAt: result.receivedAt,
        mainTimeframe: result.timeframe,
        as1Live: {
          freshness: result.freshness,
          barCloseTime: result.barCloseTime
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
    return await as1LiveRequestPromise;
  } finally {
    as1LiveRequestPromise = null;
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
    return "방금 전";
  }

  const totalMinutes = Math.floor(minutes);

  if (totalMinutes < 60) {
    return `${totalMinutes}분 전`;
  }

  if (totalMinutes < 1440) {
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    return remainingMinutes
      ? `${hours}시간 ${remainingMinutes}분 전`
      : `${hours}시간 전`;
  }

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);

  return hours
    ? `${days}일 ${hours}시간 전`
    : `${days}일 전`;
}


function getFreshnessStatus() {
  const elapsedMinutes =
    getElapsedMinutes(weatherData.updatedAt);

  if (!navigator.onLine) {
    return {
      status: "offline",
      text: elapsedMinutes === null
        ? "● OFFLINE CACHE · 마지막 관측 시각 확인 불가"
        : `● OFFLINE CACHE · 마지막 관측 ${formatElapsedTime(elapsedMinutes)}`
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
    document.querySelector("footer div");

  if (!footerFirstLine) {
    return;
  }

  const updatedAt =
    formatUpdatedAt(weatherData.updatedAt);

  if (!updatedAt) {
    footerFirstLine.textContent =
      "마지막 관측: 시각 확인 불가";

    return;
  }

  footerFirstLine.textContent =
    `마지막 관측: ${updatedAt} KST · ${formatElapsedTime(
      getElapsedMinutes(weatherData.updatedAt)
    )}`;
}


function renderApp() {
  renderStatusBadge();
  renderCurrentWeather();
  renderHourlyWeather();
  renderDailyForecast();
  renderInfoCards();
  renderLastUpdated();
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


/*
  앱 시작
*/
async function initializeApp() {
  await loadWeatherData();
  await applyConfiguredOverlay();
  renderApp();
  startFreshnessTimer();
}


/*
  온라인·오프라인 변화 감지
*/
window.addEventListener(
  "online",
  async () => {
    if (APP_DATA_MODE === "AS1_LIVE") {
      await applyAs1LiveOverlay();
    } else {
      await loadWeatherData();
      await applyConfiguredOverlay();
    }

    renderApp();
  }
);

window.addEventListener(
  "offline",
  () => {
    refreshFreshnessDisplay();
  }
);


document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);


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
