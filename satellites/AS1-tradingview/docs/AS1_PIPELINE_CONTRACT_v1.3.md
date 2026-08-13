# AS1 Pipeline Contract v1.3

`as1.v1.3` is the active design contract for TradingView Alert → server normalization → Fusion. It is a structural stabilization contract only: no Pine exporter, Alert, webhook, Edge Function, database, or credential is created.

## Layer boundaries

- Raw keeps Pine evidence: identity fields, `instrument`, `session_hint`, `timing`, `bar`, `quality`, and `payload`.
- Normalized preserves all Raw meaning without mutation and adds `canonical_instrument`, Registry identity, server `session_context`, evaluation, and deduplication identity.
- Fusion records exact Normalized/Raw provenance and classifies expected, not-expected, missing, stale, invalid, and conflicting layouts independently.

`asset_class` describes the economic underlying; `instrument_type` describes the tradable wrapper. They are orthogonal. A futures Source Profile describes the observation regime and remains stable across contract rollover; `contract_id` and server `series_segment_id` identify instances and segments.

## Session-aware freshness

Pine supplies an unvalidated `session_hint`. Registry supplies calendar, timezone, and policy. The server creates `session_context.expectation_state`, scheduling fields, and freshness. A normal closure is `NOT_EXPECTED`, not `STALE`; only `EXPECTED` observations can be missing or overdue.

## Protocol separation

Source Profile lifecycle is expressed only by `profile_status`. Protocol compatibility belongs to `as1-ingest-policy-v1.3.json`; Registry profiles contain neither `minimum_schema_version` nor `is_active`.

All schemas use JSON Schema Draft 2020-12. The common schema is reused by Raw and Normalized to make lossless inheritance enforceable.
