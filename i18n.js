"use strict";

const dictionary = Object.freeze({
  ko: {login: "로그인", account: "계정", language: "언어", community: "커뮤니티", posts: "게시판", chat: "실시간 채팅", compose: "글 작성", signInRequired: "로그인 후 이용할 수 있습니다.", setupRequired: "설정 필요", comingSoon: "준비 중", profile: "프로필", referral: "추천 코드", copy: "링크 복사", share: "공유", noUploads: "이미지·GIF·동영상·파일 업로드는 지원하지 않습니다.", aiReady: "AiLynx AI · 준비 중", liveChat: "LIVE CHAT", providerGoogle: "Google", providerKakao: "Kakao", providerToss: "Toss", providerChatgpt: "ChatGPT", terms: "약관 동의", nickname: "닉네임", onboarding: "회원 정보 설정", postPlaceholder: "텍스트로 생각을 남겨보세요", chatPlaceholder: "메시지 입력", send: "보내기", cancel: "취소"},
  en: {login: "Log in", account: "Account", language: "Language", community: "Community", posts: "Posts", chat: "Live chat", compose: "Write post", signInRequired: "Log in to participate.", setupRequired: "Setup required", comingSoon: "Coming soon", profile: "Profile", referral: "Referral code", copy: "Copy link", share: "Share", noUploads: "Image, GIF, video, and file uploads are not supported.", aiReady: "AiLynx AI · Coming soon", liveChat: "LIVE CHAT", providerGoogle: "Google", providerKakao: "Kakao", providerToss: "Toss", providerChatgpt: "ChatGPT", terms: "Accept terms", nickname: "Nickname", onboarding: "Set up your member profile", postPlaceholder: "Share a text update", chatPlaceholder: "Type a message", send: "Send", cancel: "Cancel"},
});

const storageKey = "ailynx-language";
const preferred = () => "en";
let language = localStorage.getItem(storageKey) || preferred();

function t(key) { return dictionary[language]?.[key] || dictionary.en[key] || key; }
function applyTranslations() {
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-language]").forEach((button) => button.classList.toggle("is-active", button.dataset.language === language));
  window.dispatchEvent(new CustomEvent("ailynx-language", {detail: {language}}));
}
function setLanguage(next) { if (!dictionary[next]) return; language = next; localStorage.setItem(storageKey, next); applyTranslations(); }
window.AiLynxI18n = Object.freeze({t, get language() { return language; }, setLanguage, applyTranslations});
