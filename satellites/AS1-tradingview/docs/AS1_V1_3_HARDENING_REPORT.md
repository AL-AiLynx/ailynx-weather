# AS1 v1.3 Hardening Report

This patch freezes `as1.v1.3` as the pre-Exporter integrity baseline. It does not create v1.4, alter the nine-axis design, or modify Pine sources and historical v1-v1.2 artifacts.

## Production and test isolation

The Production Raw Alert schema no longer accepts or requires `fixture_id` or `raw_event_id`. `fixture_id` remains wrapper metadata. Each wrapper now contains `simulated_ingestion` receipts that model the server assigning `raw_event_id`; Normalized and Fusion objects must preserve that generated identity.

## Independent validation

Stored age is no longer trusted. The validator recomputes `(assembly_time - bar_close_time) / 1000` at zero-second tolerance for both Normalized and Fusion. NOT_EXPECTED mapping and explicit freshness deadlines are independently enforced.

The test-only fixture Registry is schema-valid and contains the Coinbase and OKX production definitions plus clearly DRAFT equity-session and CME NQ profiles. Every Raw event resolves through it; ticker, venue, asset class, instrument type, contract type, volume unit, and canonical regime are checked. Test profiles are absent from the production Registry.

## Asynchronous MTF and rollover

NORMAL now uses four layouts across timeframes `60`, `240`, `300`, and `480`, with distinct valid close times before assembly. Provenance checks ensure Fusion component timing equals its selected Normalized observation.

ROLL previously labeled the old NQM26 component as `age_seconds=300` and FRESH even though it closed 86,700 seconds before assembly. It is now `age_seconds=86700`, STALE, with the derived base visibility corrected to 62.5 and final MIXED visibility to 53/DEGRADED. The Source Profile remains stable while contract and series-segment lifecycle values vary per observation.

## Session policy and mutation integrity

`session_policy` is now closed and requires policy type, calendar ID, timezone, default expectation, non-negative grace, and calendar source. Crypto profiles are explicit continuous 24/7 policies; fixture exchange calendars remain test authorities and do not invent real holiday schedules.

In-memory negative tests prove rejection of a 300-second age mutation, unknown Source Profile, missing normalized contract ID, and changed Fusion timeframe. No fixture is permanently modified.

## Freeze conditions

The v1.3 validator, all JSON parsing/schema checks, and the legacy v1.2 known-issues audit must pass together. Pine Exporter, TradingView Alert, and Supabase remain unimplemented and outside this freeze.

## Final Consistency Patch

`fixture_id` is now exclusively Fixture Wrapper metadata. Production Raw, Normalized, and Fusion schemas and their fixture objects reject or omit it; server-owned `raw_event_id` remains present only from Normalized onward.

Fusion summary sets are recomputed from selected components and expected slots. `stale_layouts`, `invalid_layouts`, `not_expected_layouts`, and `missing_layouts` must exactly match component/slot state. The presence of `STALE_COMPONENT_PRESENT`, `INVALID_COMPONENT_PRESENT`, and `EXPECTED_COMPONENT_MISSING` must match the corresponding recomputed set. ROLL therefore stores `stale_layouts=["HORUS_A"]` and `STALE_COMPONENT_PRESENT` while preserving its contract and segment flags.

Freshness is deterministic: NOT_EXPECTED maps to NOT_EXPECTED; for EXPECTED, assembly before the next observation is FRESH, assembly from the next observation through the deadline is AGING, and assembly after the deadline is STALE. Missing schedule inputs fail fixture validation with `DETERMINISTIC_FRESHNESS_INPUT_INCOMPLETE`; age remains independently derived from bar close time.

New in-memory mutations prove that incorrect freshness and an empty stale summary are detected without editing fixture files. The full v1.3 validation and the actually executed legacy known-issues audit both pass. With metadata isolation and all final invariants passing, `as1.v1.3` is a **FROZEN PIPELINE CONTRACT CANDIDATE**.
