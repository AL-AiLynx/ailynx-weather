# AS1 Testing and Invariants v1.3

The four JSON files under `pipeline/tests/fixtures/v1.3` are executable contract fixtures, not independent illustrations:

- `AS1_V13_NORMAL_001`: four linked layouts and NORMAL visibility.
- `AS1_V13_CLOSED_001`: all layouts NOT_EXPECTED and a null score.
- `AS1_V13_MISSING_001`: EXPECTED+MISSING contributes zero and remains in the denominator.
- `AS1_V13_ROLL_001`: one Source Profile, two dated contracts, one continuous series, and two server segments.

The validator schema-checks every layer, deep-compares Raw and Normalized `instrument`, `session_hint`, `timing`, `bar`, `quality`, and `payload`, then resolves each Fusion component back to its Normalized and Raw identities. It independently recomputes all visibility values with Decimal HALF_UP.

The v1.2 audit is a negative regression: it passes when all documented legacy defects remain detectable. It never treats those expected defects as v1.3 validity.
