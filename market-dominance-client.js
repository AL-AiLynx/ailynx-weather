export const COINGECKO_GLOBAL_ENDPOINT = "https://api.coingecko.com/api/v3/global";
export const MARKET_DOMINANCE_TIMEOUT_MS = 8000;

const DOMINANCE_ASSETS = Object.freeze([
  {key: "btc", label: "BTC.D"},
  {key: "usdt", label: "USDT.D"},
  {key: "usdc", label: "USDC.D"},
]);

function unavailable(reason) {
  return {available: false, reason};
}

function validPercentage(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function validTimestamp(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function validateMarketDominanceResponse(value) {
  const percentages = value?.data?.market_cap_percentage;
  const updatedAt = value?.data?.updated_at;

  if (!percentages || typeof percentages !== "object" || !validTimestamp(updatedAt)) {
    return unavailable("INVALID_RESPONSE");
  }

  const values = DOMINANCE_ASSETS.map((asset) => ({
    ...asset,
    value: percentages[asset.key],
  }));

  if (values.some((asset) => !validPercentage(asset.value))) {
    return unavailable("INVALID_DOMINANCE");
  }

  return {
    available: true,
    source: "COINGECKO GLOBAL MARKET CAP",
    observedAt: new Date(updatedAt * 1000).toISOString(),
    values,
  };
}

export async function fetchMarketDominance({
  fetchImpl = fetch,
  timeoutMs = MARKET_DOMINANCE_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(COINGECKO_GLOBAL_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      return unavailable("HTTP_ERROR");
    }

    return validateMarketDominanceResponse(await response.json());
  } catch (error) {
    return unavailable(controller.signal.aborted || error?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR");
  } finally {
    clearTimeout(timeoutId);
  }
}
