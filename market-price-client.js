const COINBASE_BTC_USD_TICKER_ENDPOINT =
  "https://api.exchange.coinbase.com/products/BTC-USD/ticker";

const DEFAULT_TIMEOUT_MS = 5000;

function isValidIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

export async function fetchBtcSpotPrice({
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(COINBASE_BTC_USD_TICKER_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Coinbase ticker response error: ${response.status}`);
    }

    const payload = await response.json();
    const price = Number(payload?.price);

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Coinbase ticker does not contain a valid price");
    }

    return {
      available: true,
      price,
      observedAt: isValidIsoDate(payload?.time)
        ? payload.time
        : new Date().toISOString(),
      source: "COINBASE BTC-USD SPOT",
    };
  } catch (error) {
    return {
      available: false,
      reason: error?.name === "AbortError" ? "timeout" : "request_failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export {COINBASE_BTC_USD_TICKER_ENDPOINT, DEFAULT_TIMEOUT_MS};
