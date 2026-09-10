# US100 recovery read-only readiness record

> Production project `jggazwqwalincsjegieo`, read-only query audit on 2026-09-10.
> No migration, data, schema, function, or deployment operation occurred.

## Observed AS1 contract

- `public.as1_raw_events.flags` is `jsonb`.
- The observed US100 mismatch sample is a JSON array:
  `["SOURCE_PROFILE_MISMATCH"]`.
- The validator correctly persisted that invalid outcome as
  `quality.valid = false` and `quality.sensor_quality = INVALID`.
- Converting the verified JSON array with
  `array(select jsonb_array_elements_text(raw.flags))` produces `text[]`, the
  recovered-reader contract type.

## Deterministic dry-run classification

For confirmed, invalid `SKILLING:US100` rows carrying the old BTC source profile:

| Result | Count | Interpretation |
| --- | ---: | --- |
| Recoverable | 2 | Exact single mismatch flag, full AS1/HORUS identity contract, numeric price/score, and 4H canonical timeframe. |
| Rejected | 10 | 1H rows, deliberately outside the recovery migration's 4H/1D scope. |
| Ambiguous | 0 | No row contains `SOURCE_PROFILE_MISMATCH` with an additional failure flag. |
| Source duplicates | 0 | `as1_raw_events.id` is unique for the recoverable rows. |
| Existing recovery duplicates | 0 | The recovery table is absent because this migration has not been applied. |

The recovery query uses exact JSONB equality, not a text-array cast, so a row
with any extra validation flag is not eligible. It writes only the separate
recovery table with `original_raw_event_id` as its primary key and `ON CONFLICT
DO NOTHING`; it never mutates the raw ledger.
