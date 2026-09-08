"use strict";

function renderMarketAdvisory() {
  const advisory = window.AiLynxAdvisoryConfig?.active;
  const status = document.getElementById("marketAdvisoryStatus");
  const note = document.getElementById("marketAdvisoryNote");
  const subtitle = document.getElementById("marketAdvisorySubtitle");
  if (!status || !note || !subtitle || !advisory) return;
  status.textContent = advisory.title;
  note.textContent = advisory.summary;
  subtitle.textContent = advisory.category;
}

window.addEventListener("DOMContentLoaded", renderMarketAdvisory);
