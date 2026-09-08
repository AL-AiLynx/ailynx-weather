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
    const snapshots = normalizeHistory(history);
    if (!snapshots) return null;
    const scoreStability = 100 - averagePairValue(snapshots, (previous, current) => Math.min(100, Math.abs(current.score - previous.score) * 2));
    const weatherStateStability = 100 - averagePairValue(snapshots, (previous, current) => stateDistance(previous.state, current.state));
    const majorTimeframeStability = 100 - averagePairValue(snapshots, (previous, current) => timeframeDistance(previous.majorTimeframe, current.majorTimeframe));
    const quality = snapshots.reduce((total, snapshot) => total + qualityScore(snapshot), 0) / snapshots.length;
    return clamp(scoreStability * .40 + weatherStateStability * .25 + majorTimeframeStability * .20 + quality * .15);
  },
  computeChangeRate(history) {
    const snapshots = normalizeHistory(history);
    if (!snapshots) return null;
    const previous = snapshots.at(-2), current = snapshots.at(-1);
    const scoreDelta = Math.min(100, Math.abs(current.score - previous.score) * 4);
    const weatherTransition = stateDistance(previous.state, current.state);
    const majorTimeframeTransition = timeframeDistance(previous.majorTimeframe, current.majorTimeframe);
    const qualityRecencyAdjustment = Math.min(100, (100 - qualityScore(current)) * .7 + freshnessPenalty(current.freshness));
    return clamp(scoreDelta * .50 + weatherTransition * .25 + majorTimeframeTransition * .15 + qualityRecencyAdjustment * .10);
  },
  describePersistence(score) { return Number.isFinite(score) ? score >= 80 ? "VERY STRONG" : score >= 65 ? "STRONG" : score >= 45 ? "MODERATE" : score >= 25 ? "WEAK" : "VERY WEAK" : null; },
  describeChangeRate(score) { return Number.isFinite(score) ? score < 20 ? "VERY CALM" : score < 40 ? "CALM" : score < 60 ? "MODERATE" : score < 80 ? "FAST" : "VERY FAST" : null; },
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
    majorTimeframe: item?.majorTimeframe ?? item?.timeframe,
    quality: item?.quality ?? "GOOD",
    freshness: item?.freshness ?? "FRESH",
    assetId: item?.assetId,
  }));
  const assetId = snapshots[0]?.assetId;
  return snapshots.every((item) => item.timeframe === timeframe && item.assetId === assetId && Number.isFinite(item.score) && item.score >= 0 && item.score <= 100 && typeof item.state === "string" && typeof item.valid === "boolean" && item.valid === true && Number.isFinite(item.noise) && item.noise >= 0 && item.noise <= 100 && typeof item.majorTimeframe === "string" && ["GOOD", "WATCH", "LIMITED", "CONFLICT"].includes(item.quality) && ["FRESH", "AGING"].includes(item.freshness)) ? snapshots : null;
}

function clamp(value) { return Math.round(Math.max(0, Math.min(100, value))); }
function averagePairValue(snapshots, metric) { return snapshots.slice(1).reduce((total, current, index) => total + metric(snapshots[index], current), 0) / (snapshots.length - 1); }
function stateDistance(previous, current) { const order = ["RAIN", "CLOUDY", "PARTLY_CLOUDY", "SUNNY"]; const from = order.indexOf(previous), to = order.indexOf(current); return from < 0 || to < 0 ? 100 : Math.abs(from - to) / (order.length - 1) * 100; }
function timeframeMinutes(value) { const hours = /^(\d+)H$/.exec(value); return hours ? Number(hours[1]) * 60 : value === "1D" ? 1440 : value === "1W" ? 10080 : NaN; }
function timeframeDistance(previous, current) { const from = timeframeMinutes(previous), to = timeframeMinutes(current); return Number.isFinite(from) && Number.isFinite(to) && from > 0 && to > 0 ? Math.min(100, Math.abs(Math.log2(to / from)) * 35) : 100; }
function qualityScore(snapshot) { return snapshot.valid ? ({GOOD: 100, WATCH: 75, LIMITED: 55, CONFLICT: 20}[snapshot.quality] ?? 0) : 0; }
function freshnessPenalty(freshness) { return freshness === "AGING" ? 25 : freshness === "FRESH" ? 0 : 100; }
