import assert from "node:assert/strict";
import test from "node:test";
import {hasCoreTransition, leaderPresentation, metricPresentation} from "../core-dynamics.js";

test("core persistence renders a bounded numeric value and its Korean band", () => {
  assert.deepEqual(metricPresentation(72, "persistence"), {ready: true, value: 72, band: "강함", note: ""});
  assert.equal(metricPresentation(80, "persistence").band, "매우 강함");
  assert.equal(metricPresentation(24, "persistence").band, "매우 약함");
});

test("core change rate renders a bounded numeric value and its Korean band", () => {
  assert.deepEqual(metricPresentation(38, "changeRate"), {ready: true, value: 38, band: "안정", note: ""});
  assert.equal(metricPresentation(80, "changeRate").band, "매우 빠름");
  assert.equal(metricPresentation(19, "changeRate").band, "매우 안정");
});

test("missing history remains an explicit accumulation state without a preview number", () => {
  assert.deepEqual(metricPresentation(null, "persistence"), {ready: false, value: null, band: "관측 축적 중", note: "관측 0 / 2 · 유효 관측이 쌓이면 표시합니다."});
  assert.equal(metricPresentation(null, "changeRate", 1).note, "관측 1 / 2 · 유효 관측이 쌓이면 표시합니다.");
});

test("leader only accepts an observed canonical timeframe and updates on a real change", () => {
  assert.equal(leaderPresentation("4H").value, "4H");
  assert.equal(leaderPresentation("WAITING").value, "—");
  assert.equal(hasCoreTransition(undefined, "4H"), false);
  assert.equal(hasCoreTransition("4H", "6H"), true);
});
