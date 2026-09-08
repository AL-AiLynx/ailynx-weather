import {assertEquals} from "jsr:@std/assert@1";
import {projectHorusResponse} from "../../as1-horus-read/project-response.ts";

const NOW = new Date("2026-09-08T01:00:00.000Z");
function row(timeframe: string, close: number, receivedAt = "2026-09-08T00:00:00.000Z", valid = true) {
  const barClose = 1_788_825_600_000 + close;
  const raw = {schema_version: "as1.v1.4", satellite_id: "AS1", platform: "TRADINGVIEW", layout_id: "HORUS_A", observer: "HORUS", source_profile_code: "CB_BTCUSD_SPOT_20260722_V1", packet_type: "BAR_CLOSE_SNAPSHOT", confirmed: true, instrument: {ticker_id: "COINBASE:BTCUSD", venue: "COINBASE", symbol: "BTCUSD"}, timing: {timeframe, bar_open_time: barClose - 3600_000, bar_close_time: barClose}, bar: {close: 79_000 + close}, quality: {sensor_quality: valid ? "GOOD" : "INVALID", valid, flags: valid ? [] : ["BAD_SENSOR"]}, payload: {horus: {dir: "UP"}}};
  return {...raw, received_at: receivedAt, ticker_id: "COINBASE:BTCUSD", venue: "COINBASE", symbol: "BTCUSD", timeframe, bar_open_time: barClose - 3600_000, bar_close_time: barClose, sensor_quality: raw.quality.sensor_quality, valid, flags: raw.quality.flags, raw_envelope: raw};
}

Deno.test("selects the latest exact HORUS_A packet per canonical timeframe", () => {
  const result = projectHorusResponse([row("60", 1), row("60", 2), row("D", 3), row("2D", 4), row("1W", 5)], NOW);
  assertEquals(result.timeframes["1H"].available, true);
  assertEquals(result.timeframes["1H"].bar.close, 79_002);
  assertEquals(result.timeframes["1D"].timeframe, "1D");
  assertEquals(result.timeframes["2D"].available, true);
  assertEquals(result.timeframes["3H"], {available: false, reason: "NO_OBSERVATION"});
});

Deno.test("does not substitute an invalid newest packet", () => {
  const result = projectHorusResponse([row("120", 1), row("120", 2, "2026-09-08T00:01:00.000Z", false)], NOW);
  assertEquals(result.timeframes["2H"].available, true);
  assertEquals(result.timeframes["2H"].quality.valid, false);
  assertEquals(result.timeframes["2H"].quality.sensor_quality, "INVALID");
});
