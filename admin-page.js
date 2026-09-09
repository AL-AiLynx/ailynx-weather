"use strict";

import {isCurrentUserAdmin} from "./admin-access.js?v=2";
import {ADMIN_PREVIEW_MODES, previewUrl} from "./admin-preview.js?v=1";
import {fetchAdminAssetObservations} from "./admin-asset-client.js?v=1";
import {resolveMembership} from "./membership-client.js?v=2";

const shell = document.getElementById("adminPageShell");
const status = document.getElementById("adminRouteCheck");
const redirectToWeather = () => window.location.replace("/");
const planLabel = (plan) => window.LynxDashboardConfig?.plans?.[plan]?.label || "무료";
const modeLabel = (mode) => mode === "ADMIN" ? "관리자 전체" : planLabel(mode);
const item = (label, value) => {
  const row = document.createElement("div");
  const key = document.createElement("span");
  const content = document.createElement("strong");
  key.textContent = label;
  content.textContent = value;
  row.append(key, content);
  return row;
};
const createCell = (value, heading = false) => {
  const cell = document.createElement(heading ? "th" : "td");
  cell.textContent = value;
  return cell;
};

const entitlementRows = Object.freeze([
  ["BTCUSD", "O", "O", "O", "O"],
  ["US100", "O", "O", "O", "O"],
  ["XAUUSD", "—", "O", "O", "O"],
  ["DXY", "—", "O", "O", "O"],
  ["시장 리드 TF", "—", "O", "O", "O"],
  ["1D", "—", "O", "O", "O"],
  ["2D~1W", "—", "—", "O", "O"],
  ["정밀 검증", "—", "—", "—", "O"],
  ["Mobile Viewer", "—", "—", "—", "O"],
]);

function createEntitlementMatrix() {
  const section = document.createElement("section");
  const title = document.createElement("h2");
  const note = document.createElement("p");
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const body = document.createElement("tbody");
  title.textContent = "권한 매트릭스";
  note.textContent = "현재 Weather 정책을 기준으로 한 검증용 표시입니다. 실제 구독 데이터는 수정하지 않습니다.";
  section.className = "admin-section";
  table.className = "admin-matrix";
  const header = document.createElement("tr");
  ["기능", "무료", "플러스", "프리미엄", "프로"].forEach((value) => header.append(createCell(value, true)));
  head.append(header);
  entitlementRows.forEach((values) => {
    const row = document.createElement("tr");
    values.forEach((value) => row.append(createCell(value)));
    body.append(row);
  });
  table.append(head, body);
  section.append(title, note, table);
  return section;
}

function observationState(result) {
  const latest = result?.latestReceipt;
  if (!result?.available || result.status !== "LIVE" || latest?.valid !== true || !["FRESH", "AGING"].includes(latest.freshness)) return "관측 준비 중 · NO DATA";
  const observedAt = new Date(latest.receivedAt);
  const time = Number.isFinite(observedAt.getTime()) ? observedAt.toLocaleString("ko-KR", {hour12: false}) : "시각 확인 불가";
  return `LIVE · ${latest.freshness} · 마지막 관측 ${time}`;
}

async function createLiveDataSection(config, session) {
  const section = document.createElement("section");
  const title = document.createElement("h2");
  const note = document.createElement("p");
  const details = document.createElement("div");
  section.className = "admin-section";
  details.className = "admin-page-details";
  title.textContent = "실측 관측 상태";
  note.textContent = "서버 검증된 관리자 세션에서만 고정된 자산별 관측 경로를 확인합니다. 유효하고 신선한 동일 자산 receipt만 LIVE로 표시합니다.";
  section.append(title, note, details);
  const assets = ["BTCUSD", "US100", "XAUUSD", "DXY"];
  const results = await Promise.all(assets.map(async (asset) => ({asset, result: await fetchAdminAssetObservations({asset, config, session})})));
  results.forEach(({asset, result}) => details.append(item(asset, observationState(result))));
  return section;
}

function createPreviewSection() {
  const section = document.createElement("section");
  const title = document.createElement("h2");
  const note = document.createElement("p");
  const controls = document.createElement("div");
  const select = document.createElement("select");
  const button = document.createElement("button");
  const exit = document.createElement("a");
  section.className = "admin-section admin-preview-section";
  title.textContent = "권한 미리보기";
  note.textContent = "선택한 화면은 현재 관리자 세션에서만 열리며, subscriptions.plan_code를 변경하지 않습니다.";
  controls.className = "admin-preview-controls";
  ADMIN_PREVIEW_MODES.forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = modeLabel(mode);
    select.append(option);
  });
  button.type = "button";
  button.textContent = "Weather에서 미리보기";
  button.addEventListener("click", () => window.location.assign(previewUrl(select.value)));
  exit.href = "/";
  exit.textContent = "일반 Weather 보기";
  controls.append(select, button, exit);
  section.append(title, note, controls);
  return section;
}

async function initializeAdminPage() {
  const config = window.AiLynxCommunityConfig;
  const authClient = window.AiLynxSupabaseAuth;
  let session = null;
  try { session = await authClient?.getSession?.(); } catch { session = null; }
  const verified = await isCurrentUserAdmin({config, session});
  if (!verified || !session?.user) return redirectToWeather();
  const membership = await resolveMembership({config, authClient: {getSession: async () => session}});
  const eyebrow = document.createElement("p");
  const title = document.createElement("h1");
  const summary = document.createElement("p");
  const details = document.createElement("section");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "AILYNX ADMIN";
  title.textContent = "관리자 대시보드";
  summary.textContent = "서버 검증 ADMIN 권한으로 열렸습니다. 일반 사용자 권한과 구독 정보는 변경되지 않습니다.";
  details.className = "admin-page-details";
  details.append(
    item("관리자 인증 상태", "ADMIN · 서버 검증 완료"),
    item("현재 로그인 계정", session.user.email || "계정 정보 없음"),
    item("현재 subscription plan", planLabel(membership.plan)),
    item("환경", "Production")
  );
  shell.replaceChildren(eyebrow, title, summary, details, createPreviewSection(), createEntitlementMatrix(), await createLiveDataSection(config, session));
  shell.hidden = false;
  status.remove();
}

void initializeAdminPage();
