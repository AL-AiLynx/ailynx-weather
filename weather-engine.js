"use strict";

const HORUS_WINDOW_FORCE_WAIT =
  "HORUS_WINDOW_FORCE_WAIT";


function translateHorusToWeather(input) {
  const data = input && typeof input === "object"
    ? input
    : {};

  const matchesWindowForceWait =
    data.horusA?.state === "WEAK" &&
    data.horusB?.state === "WAIT" &&
    data.maat?.phase === "VOL_TRIGGER_WAIT" &&
    data.maat?.result === "WINDOW_OPEN" &&
    data.maat?.volume === "WAIT" &&
    data.maat?.reset === "NO";

  if (matchesWindowForceWait) {
    return {
      ruleId: HORUS_WINDOW_FORCE_WAIT,
      weather: {
        icon: "PARTLY_CLOUDY",
        name: "구름 조금",
        energy: null
      },
      condition: "FORCE_WAIT",
      watchLevel: {
        level: "MEDIUM",
        text: "관찰 필요",
        description:
          "구조는 유지되지만 힘과 거래량이 아직 부족합니다."
      },
      headline:
        "시간창은 열려 있지만 엔진 힘이 약합니다. 작은 움직임보다 힘과 거래량이 붙는지 확인합니다.",
      reasonCodes: [
        "WINDOW_OPEN",
        "FORCE_WEAK",
        "STRUCTURE_WAIT",
        "VOLUME_WAIT",
        "RESET_NO"
      ]
    };
  }

  return {
    ruleId: "NO_MATCHING_RULE",
    weather: {
      icon: "CLOUDY",
      name: "판정 대기",
      energy: null
    },
    condition: "UNCLASSIFIED",
    watchLevel: {
      level: "UNKNOWN",
      text: "추가 확인 필요",
      description:
        "현재 HORUS 조합에 등록된 날씨 규칙이 없습니다."
    },
    headline:
      "현재 상태를 분류하려면 추가 규칙 또는 추가 시간축 데이터가 필요합니다.",
    reasonCodes: [
      "NO_MATCHING_RULE"
    ]
  };
}


window.AiLynxWeatherEngine = {
  translateHorusToWeather
};
