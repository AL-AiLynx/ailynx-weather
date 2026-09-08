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
  translateHorusToWeather,
  computeWeatherScore(input) {
    const {horus, maat, hub, time, timeframe} = input || {};
    if (![horus, maat, hub, time].every((item) => item?.available && item.quality?.valid) || !time.payload?.time?.valid) return null;
    const aggregate = maat.payload?.aggregate, hubScores = hub.payload?.scores, timeState = time.payload?.time, noise = maat.payload?.stopwatch?.noise_score;
    const sensorCount = Object.values(maat.payload?.sensors || {}).filter((sensor) => sensor?.valid).length;
    const horusScore = Number.isFinite(horus.state?.score) ? horus.state.score : horus.state?.gate_score;
    const values = [aggregate?.score, hubScores?.structure, hubScores?.force, hubScores?.window, timeState?.score, timeState?.noise_score, noise, horusScore];
    if (values.some((value) => !Number.isFinite(value))) return null;
    // This is an observation-alignment score, not a price forecast or direction signal.
    // It only combines fields carried by the validated LIVE contracts above.
    const score = aggregate.score * .20 + hubScores.structure * .18 + hubScores.force * .16 + hubScores.window * .14 + timeState.score * .10 + horusScore * .12 + sensorCount / 6 * 10 - ((noise + timeState.noise_score) / 2 * .15);
    return Number.isFinite(score) && score >= 0 && score <= 100 ? {score: Math.round(score), coverage: "FULL", confidence: "HIGH", timeframe} : null;
  },
  computeDurability(history) {
    // History is oldest-to-newest and must contain same-timeframe valid snapshots.
    const snapshots = normalizeHistory(history);
    if (!snapshots) return null;
    const current = snapshots.at(-1);
    const stateStreak = snapshots.slice().reverse().findIndex((item) => item.state !== current.state);
    const streak = (stateStreak === -1 ? snapshots.length : stateStreak) / snapshots.length * 100;
    const averageChange = snapshots.slice(1).reduce((total, item, index) => total + Math.abs(item.score - snapshots[index].score), 0) / (snapshots.length - 1);
    const scoreStability = Math.max(0, 100 - averageChange * 2);
    const qualityContinuity = snapshots.filter((item) => item.valid).length / snapshots.length * 100;
    const noiseContinuity = 100 - snapshots.reduce((total, item) => total + item.noise, 0) / snapshots.length;
    return Math.round(streak * .30 + scoreStability * .30 + qualityContinuity * .25 + noiseContinuity * .15);
  },
  computeChangeRate(history) {
    const snapshots = normalizeHistory(history);
    if (!snapshots) return null;
    // Current score minus the immediately prior valid score, never another timeframe.
    return Math.round(snapshots.at(-1).score - snapshots.at(-2).score);
  },
  classifyWeather(score) {
    if (!Number.isFinite(score)) return null;
    if (score <= 25) return {state: "RAIN", label: "RAIN", icon: "RAIN"};
    if (score <= 51) return {state: "CLOUDY", label: "CLOUDY", icon: "CLOUDY"};
    if (score <= 75) return {state: "PARTLY_CLOUDY", label: "PARTLY CLOUDY", icon: "PARTLY_CLOUDY"};
    return {state: "SUNNY", label: "SUNNY", icon: "SUNNY"};
  }
};

function normalizeHistory(history) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const timeframe = history[0]?.timeframe;
  if (typeof timeframe !== "string" || !timeframe) return null;
  const snapshots = history.map((item) => ({
    timeframe: item?.timeframe,
    score: item?.score,
    state: item?.state,
    valid: item?.valid,
    noise: item?.noise,
  }));
  return snapshots.every((item) => item.timeframe === timeframe && Number.isFinite(item.score) && item.score >= 0 && item.score <= 100 && typeof item.state === "string" && typeof item.valid === "boolean" && Number.isFinite(item.noise) && item.noise >= 0 && item.noise <= 100) ? snapshots : null;
}
