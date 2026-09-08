export const PWA_VISIT_COUNTER_ENDPOINT =
  "https://jggazwqwalincsjegieo.supabase.co/functions/v1/pwa-visit-counter";
export const PWA_VISIT_COUNTER_TIMEOUT_MS = 5000;
export const PWA_VISIT_SESSION_KEY = "ailynx-pwa-visit-recorded-v1";

function unavailable(reason) {
  return {available: false, reason};
}

export function validateVisitStats(value) {
  const stats = value?.stats;
  if (
    value?.ok !== true ||
    !stats ||
    !Number.isSafeInteger(stats.total_visits) ||
    !Number.isSafeInteger(stats.today_visits) ||
    stats.total_visits < 0 ||
    stats.today_visits < 0 ||
    typeof stats.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(stats.date)
  ) {
    return unavailable("INVALID_RESPONSE");
  }

  return {
    available: true,
    totalVisits: stats.total_visits,
    todayVisits: stats.today_visits,
    date: stats.date,
  };
}

export async function fetchVisitStats({
  method = "GET",
  fetchImpl = fetch,
  timeoutMs = PWA_VISIT_COUNTER_TIMEOUT_MS,
} = {}) {
  if (method !== "GET" && method !== "POST") {
    return unavailable("INVALID_REQUEST");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(PWA_VISIT_COUNTER_ENDPOINT, {
      method,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      return unavailable("HTTP_ERROR");
    }

    return validateVisitStats(await response.json());
  } catch (error) {
    return unavailable(controller.signal.aborted || error?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR");
  } finally {
    clearTimeout(timeoutId);
  }
}
