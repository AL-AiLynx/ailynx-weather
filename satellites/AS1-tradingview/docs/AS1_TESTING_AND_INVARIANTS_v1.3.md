# AS1 Testing and Invariants v1.3

The four JSON files under `pipeline/tests/fixtures/v1.3` are executable contract fixtures, not independent illustrations:

- `AS1_V13_NORMAL_001`: four linked layouts with at least three timeframes and two close times, proving asynchronous MTF assembly.
- `AS1_V13_CLOSED_001`: all layouts NOT_EXPECTED and a null score.
- `AS1_V13_MISSING_001`: EXPECTED+MISSING contributes zero and remains in the denominator.
- `AS1_V13_ROLL_001`: one Source Profile, two dated contracts, one continuous series, and two server segments.

Raw fixture events contain only production Pine fields. The wrapper's `simulated_ingestion` receipts model server-generated `raw_event_id` values; Normalized and Fusion provenance must resolve through those receipts.

The validator schema-checks every layer, resolves each Raw `source_profile_code` through the schema-valid fixture Registry, and checks canonical regime and instrument dimensions. It deep-compares preserved Raw/Normalized fields, then resolves each Fusion component back through Normalized to its ingestion receipt.

For every Fusion component, `age_seconds` is recomputed as `(assembly_time - bar_close_time) / 1000` with zero-second tolerance. An EXPECTED observation past its explicit freshness deadline cannot be FRESH, and NOT_EXPECTED must map to NOT_EXPECTED freshness. Visibility is independently recomputed with Decimal HALF_UP.

In-memory negative mutations must detect a 300-second age error, an unknown profile, a missing contract ID, and changed Fusion timeframe. Fixture files are never mutated by these tests.

The v1.2 audit is a negative regression: it passes when all documented legacy defects remain detectable. It never treats those expected defects as v1.3 validity.
