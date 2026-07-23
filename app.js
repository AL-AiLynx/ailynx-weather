"use strict";

/*
  AiLynx Bitcoin Weather
  HORUS 연결 전 화면 테스트용 샘플 데이터
*/

const weatherData = {
  price: 65240,
  priceChange: 1.48,

  headline:
    "단기 힘은 유지되고 있지만 상위 시간축의 길은 아직 완전히 열리지 않았습니다. 지금은 작은 흔들림보다 다음 확인 시각을 기다리는 편이 안전합니다.",

  weather: {
    icon: "🌤️",
    name: "구름 조금",
    energy: 69
  },

  hourly: [
    {
      time: "09:00",
      icon: "☀️",
      energy: 62,
      probability: 10
    },
    {
      time: "10:00",
      icon: "🌤️",
      energy: 64,
      probability: 15
    },
    {
      time: "11:00",
      icon: "🌤️",
      energy: 66,
      probability: 20
    },
    {
      time: "12:00",
      icon: "⛅",
      energy: 68,
      probability: 30
    },
    {
      time: "13:00",
      icon: "☁️",
      energy: 71,
      probability: 45
    },
    {
      time: "14:00",
      icon: "🌦️",
      energy: 74,
      probability: 60
    },
    {
      time: "15:00",
      icon: "🌧️",
      energy: 76,
      probability: 70
    },
    {
      time: "16:00",
      icon: "☁️",
      energy: 70,
      probability: 40
    }
  ],

  /*
    1D~1W 시간축의 상태 샘플
    가격 방향 예측이 아니라 관찰 일정
  */
  daily: [
    {
      day: "오늘",
      timeframe: "1D",
      icon: "🌤️",
      status: "구름 조금",
      note: "단기 힘 유지",
      probability: 30,
      upperEnergy: 72,
      lowerEnergy: 64
    },
    {
      day: "화",
      timeframe: "2D",
      icon: "☀️",
      status: "맑음",
      note: "구조 안정 확인",
      probability: 20,
      upperEnergy: 74,
      lowerEnergy: 66
    },
    {
      day: "수",
      timeframe: "3D",
      icon: "🌦️",
      status: "소나기 가능",
      note: "힘 발현 창 관찰",
      probability: 60,
      upperEnergy: 78,
      lowerEnergy: 63
    },
    {
      day: "목",
      timeframe: "4D",
      icon: "🌧️",
      status: "변동성 주의",
      note: "상위 구조 충돌",
      probability: 65,
      upperEnergy: 81,
      lowerEnergy: 61
    },
    {
      day: "금",
      timeframe: "5D",
      icon: "☁️",
      status: "흐림",
      note: "방향 합치 대기",
      probability: 45,
      upperEnergy: 73,
      lowerEnergy: 62
    },
    {
      day: "토",
      timeframe: "6D",
      icon: "🌤️",
      status: "구름 조금",
      note: "회복 여부 확인",
      probability: 35,
      upperEnergy: 75,
      lowerEnergy: 65
    },
    {
      day: "일",
      timeframe: "1W",
      icon: "⛅",
      status: "부분 흐림",
      note: "주봉 마감 관찰",
      probability: 40,
      upperEnergy: 77,
      lowerEnergy: 64
    }
  ],

  mainTimeframe: "470분",
  nextCheck: "15:00 KST",

  watchLevel: {
    text: "지금은 낮음",
    description:
      "차트를 계속 볼 필요 없이 다음 확인 시각까지 기다립니다."
  }
};


/*
  가격 형식 변환
*/
function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}


/*
  현재 한국 시각
*/
function getCurrentKST() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}


/*
  현재 날씨 카드
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
    console.error(
      "현재 날씨 화면 요소를 찾지 못했습니다."
    );

    return;
  }

  priceElement.textContent =
    formatPrice(weatherData.price);

  const sign =
    weatherData.priceChange >= 0 ? "+" : "";

  changeElement.textContent =
    `${sign}${weatherData.priceChange.toFixed(2)}% · 24시간`;

  headlineElement.textContent =
    weatherData.headline;

  weatherIconElement.textContent =
    weatherData.weather.icon;

  weatherNameElement.textContent =
    weatherData.weather.name;

  energyElement.textContent =
    `현재 시장 에너지 ${weatherData.weather.energy}°`;
}


/*
  시간축별 날씨
*/
function renderHourlyWeather() {
  const hourCards =
    document.querySelectorAll(".hour");

  hourCards.forEach((card, index) => {
    const data =
      weatherData.hourly[index];

    if (!data) {
      card.style.display = "none";
      return;
    }

    const timeElement =
      card.querySelector(".hour-time");

    const iconElement =
      card.querySelector(".hour-icon");

    const energyElement =
      card.querySelector(".hour-energy");

    const probabilityElement =
      card.querySelector(".hour-rain");

    if (
      !timeElement ||
      !iconElement ||
      !energyElement ||
      !probabilityElement
    ) {
      return;
    }

    timeElement.textContent =
      data.time;

    iconElement.textContent =
      data.icon;

    energyElement.textContent =
      `${data.energy}°`;

    probabilityElement.textContent =
      `💧 ${data.probability}%`;
  });
}


/*
  상위 시간축 예보
*/
function renderDailyForecast() {
  const dailyContainer =
    document.querySelector("#dailyForecast");

  if (!dailyContainer) {
    console.error(
      "상위 시간축 예보 영역을 찾지 못했습니다."
    );

    return;
  }

  dailyContainer.innerHTML = "";

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
          ${data.icon}
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
        ${data.upperEnergy}° / ${data.lowerEnergy}°
      </div>
    `;

    dailyContainer.appendChild(row);
  });
}


/*
  주인공 시간축·다음 확인·관찰 필요도
*/
function renderInfoCards() {
  const infoValues =
    document.querySelectorAll(".info-value");

  const infoDescriptions =
    document.querySelectorAll(
      ".info-description"
    );

  if (
    infoValues.length < 3 ||
    infoDescriptions.length < 3
  ) {
    console.error(
      "하단 정보 카드를 찾지 못했습니다."
    );

    return;
  }

  infoValues[0].textContent =
    weatherData.mainTimeframe;

  infoValues[1].textContent =
    weatherData.nextCheck;

  infoValues[2].textContent =
    weatherData.watchLevel.text;

  infoDescriptions[2].textContent =
    weatherData.watchLevel.description;
}


/*
  마지막 업데이트 시각
*/
function renderLastUpdated() {
  const footerFirstLine =
    document.querySelector("footer div");

  if (!footerFirstLine) {
    return;
  }

  footerFirstLine.textContent =
    `마지막 업데이트: ${getCurrentKST()} KST`;
}


/*
  앱 실행
*/
function initializeApp() {
  try {
    renderCurrentWeather();
    renderHourlyWeather();
    renderDailyForecast();
    renderInfoCards();
    renderLastUpdated();

    console.log(
      "AiLynx Weather 화면 연결 성공"
    );
  } catch (error) {
    console.error(
      "AiLynx Weather 실행 오류:",
      error
    );
  }
}


document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);
/*
  AiLynx PWA 서비스 워커 등록
*/
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
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
  });
}