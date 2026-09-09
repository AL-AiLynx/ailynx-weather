"use strict";

import {isCurrentUserAdmin} from "./admin-access.js?v=2";
import {resolveMembership} from "./membership-client.js?v=2";

const shell = document.getElementById("adminPageShell");
const status = document.getElementById("adminRouteCheck");
const redirectToWeather = () => window.location.replace("/");
const planLabel = (plan) => window.LynxDashboardConfig?.plans?.[plan]?.label || "무료";
const item = (label, value) => {
  const row = document.createElement("div");
  const key = document.createElement("span");
  const content = document.createElement("strong");
  key.textContent = label;
  content.textContent = value;
  row.append(key, content);
  return row;
};

async function initializeAdminPage() {
  const config = window.AiLynxCommunityConfig;
  const authClient = window.AiLynxSupabaseAuth;
  const session = await authClient?.getSession?.().catch(() => null);
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
  summary.textContent = "서버 검증 ADMIN 권한으로 열렸습니다.";
  details.className = "admin-page-details";
  details.append(
    item("관리자 인증 상태", "ADMIN · 서버 검증 완료"),
    item("현재 로그인 계정", session.user.email || "계정 정보 없음"),
    item("현재 subscription plan", planLabel(membership.plan)),
    item("환경", "Production")
  );
  shell.replaceChildren(eyebrow, title, summary, details);
  shell.hidden = false;
  status.remove();
}

void initializeAdminPage();
