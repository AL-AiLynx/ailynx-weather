"use strict";

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

    weatherData = data;

    console.log(
      "AiLynx JSON 데이터 연결 성공"
    );
  } catch (error) {
    console.error(
      "AiLynx JSON 데이터 연결 실패:",
      error
    );

    weatherData = FALLBACK_DATA;
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
  데이터 관측 시각 표시
*/
function formatUpdatedAt(value) {
  if (!value) {
    return "시각 확인 불가";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "시각 확인 불가";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}


/*
  상단 상태 배지
*/
function renderStatusBadge() {
  const badge =
    document.querySelector(".live-badge");

  if (!badge) {
    return;
  }

  if (!navigator.onLine) {
    badge.textContent =
      "● OFFLINE CACHE";

    return;
  }

  if (weatherData.mode === "SAMPLE") {
    badge.textContent =
      "● SAMPLE DATA";

    return;
  }

  badge.textContent =
    "● LIVE DATA";
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
    `현재 시장 에너지 ${weatherData.weather.energy}°`;
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

  weatherData.hourly.forEach((data) => {
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

  weatherData.daily.forEach((data) => {
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
  마지막 관측 시각
*/
function renderLastUpdated() {
  const footerFirstLine =
    document.querySelector(
      "footer div"
    );

  if (!footerFirstLine) {
    return;
  }

  footerFirstLine.textContent =
    `마지막 관측: ${formatUpdatedAt(
      weatherData.updatedAt
    )} KST`;
}


/*
  전체 화면 표시
*/
function renderApp() {
  renderStatusBadge();
  renderCurrentWeather();
  renderHourlyWeather();
  renderDailyForecast();
  renderInfoCards();
  renderLastUpdated();
}


/*
  앱 시작
*/
async function initializeApp() {
  await loadWeatherData();
  renderApp();
}


/*
  온라인·오프라인 변화 감지
*/
window.addEventListener(
  "online",
  async () => {
    await loadWeatherData();
    renderApp();
  }
);

window.addEventListener(
  "offline",
  () => {
    renderStatusBadge();
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