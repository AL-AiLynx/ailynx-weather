# AS1 MAAT / MAAT2 Raw Alert Contract v1.4

`as1.v1.4` is an additive Raw Alert promotion. `as1.v1.3` remains the frozen Normalized/Fusion baseline and remains accepted for existing HORUS traffic. This revision does not reinterpret old rows.

## Packet identity

| View | Layout | Observer | Packet type | Contract payload |
| --- | --- | --- | --- | --- |
| MAAT validation | `MAAT` | `MAAT` | `VALIDATION_SNAPSHOT` | `maat.validation.v1` |
| MAAT2 Hub | `MAAT2` | `MAAT2_HUB` | `HUB_STATE_SNAPSHOT` | `maat2.hub.v1` |
| MAAT2 Time | `MAAT2` | `MAAT2_TIME` | `TIME_ENGINE_SNAPSHOT` | `maat2.time.v1` |

The server must reject any layout/observer/packet mismatch. Hub and Time are separate facts even when they close on the same bar.

## Client event key

The canonical v1.4 key is:

```text
AS1|layout_id|packet_type|ticker_id|timeframe|bar_close_time|as1.v1.4
```

The ingest layer must reconstruct this value from parsed fields and reject a supplied mismatch. Pattern validation alone is insufficient. Including `packet_type` prevents MAAT2 Hub/Time key collision.

## Runtime gate

Export is permitted only when all conditions are true:

- the Pine export input is enabled (default is OFF);
- the chart is `COINBASE:BTCUSD`;
- the chart timeframe is 4H, 8H, 12H, or 1D (`240`, `480`, `720`, `D`, `1D`, `1440`);
- the bar is confirmed and realtime;
- the exact client event key has not already been emitted by that script instance.

The alert uses `alert.freq_once_per_bar_close`. No plot or calculation is added or changed.

## Semantic boundary

MAAT is a stopwatch validator. It may transmit sensor state, aggregate state, an observed volume event, and the current validation window. It must not turn those observations into a prediction or automatic HIT/MISS result. `validation_outcome=PENDING` and `automatic_hit_miss=SUPPRESSED` are mandatory.

MAAT2 Hub and Time remain separate packets. The Time packet explicitly uses `prediction_direction=NOT_PROVIDED` and `automatic_hit_miss=NOT_IMPLEMENTED`. Expected window timestamps remain `null` until the calculation truly supplies them.

Invalid or partial sensors are transmitted with `quality.valid=false` and flags; they are not silently dropped. Freshness is computed by the read service from server receipt time and the selected timeframe cadence.

## Read projection

`as1-validation-read` accepts only `view` and `timeframe` selectors from fixed allowlists. It reads `as1_raw_events`, revalidates flattened columns against the Raw envelope, reconstructs the event key, and returns only the PWA field projection. It never exposes `id`, `client_event_key`, `raw_envelope`, credentials, or arbitrary payload additions.

The ingest and read endpoints are deployed to `ailynx-core-prod`. `as1-ingest` function v6 strictly validates nested v1.4 payload types and ranges before enqueue; `as1-validation-read` is active at function v2. Token rotation and the no-token `401`, wrong-token `401`, valid authenticated `202`, nested-schema `400`, and read-projection `200` paths are verified. The PWA code remains a local implementation artifact. TradingView Alert creation/webhook activation and PWA deployment remain separate operational actions.
