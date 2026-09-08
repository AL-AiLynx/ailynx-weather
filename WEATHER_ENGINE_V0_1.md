# Weather Engine v0.1

The engine converts validated LIVE observations into a weather **observation-alignment** score. It is not a price forecast, a trade signal, or a directional prediction.

## FULL-score contract

A score is published only when all four sources are available and valid for the selected timeframe:

- HORUS state score (or gate score)
- MAAT aggregate score, valid sensor count, and stopwatch noise
- MAAT2 Hub structure, force, and window scores
- MAAT2 Time score and noise, with `time.valid === true`

The 0–100 score weights are: MAAT aggregate 20%, Hub structure 18%, Hub force 16%, Hub window 14%, MAAT2 Time 10%, HORUS 12%, valid sensor coverage up to 10%, less the mean MAAT/Time noise at 15%.

Weather bands: 0–25 RAIN, 26–51 CLOUDY, 52–75 PARTLY CLOUDY, and 76–100 SUNNY. A missing, invalid, non-finite, or out-of-range input produces no score.

## Current history boundary

The public LIVE reader does not yet expose prior same-timeframe weather snapshots. `computeDurability` and `computeChangeRate` therefore return `null`, and the UI displays `WAITING`. They must not be derived from a single observation.

When an ordered (oldest-to-newest) sequence of at least two valid snapshots for one timeframe becomes available, durability is `30% state-streak + 30% score stability + 25% quality continuity + 15% noise continuity`. Score stability is `100 - 2 × mean adjacent score change`; noise continuity is `100 - mean noise`. Change rate is simply `current score - immediately prior valid score`. Mixed-timeframe, malformed, or insufficient history returns `null`.
