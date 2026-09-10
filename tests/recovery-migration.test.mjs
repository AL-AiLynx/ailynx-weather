import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {fileURLToPath} from "node:url";

const migration = fileURLToPath(new URL("../supabase/migrations/20260910150000_recover_us100_profile_mismatch_observations.sql", import.meta.url));
const readerGrant = fileURLToPath(new URL("../supabase/migrations/20260910160000_grant_recovery_reader_access.sql", import.meta.url));
const reader = fileURLToPath(new URL("../supabase/functions/as1-asset-read/index.ts", import.meta.url));

test("US100 recovery migration preserves raw rows and permits only the known deterministic mismatch", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /^begin;/im);
  assert.match(sql, /create table if not exists public\.as1_recovered_observations/i);
  assert.match(sql, /original_raw_event_id text primary key/i);
  assert.match(sql, /raw\.ticker_id = 'SKILLING:US100'/);
  assert.match(sql, /raw\.source_profile_code = 'CB_BTCUSD_SPOT_20260722_V1'/);
  assert.match(sql, /jsonb_typeof\(raw\.flags\) = 'array'/);
  assert.match(sql, /raw\.flags = jsonb_build_array\('SOURCE_PROFILE_MISMATCH'\)/);
  assert.match(sql, /array\(select jsonb_array_elements_text\(flags\)\)/i);
  assert.match(sql, /sensor_quality text not null check \(sensor_quality in \('GOOD', 'LIMITED', 'WATCH', 'INVALID'\)\)/);
  assert.match(sql, /when '240' then '4H'/);
  assert.match(sql, /when '1440' then '1D'/);
  assert.match(sql, /'SKILLING_US100_CFD_V1'/);
  assert.match(sql, /on conflict \(original_raw_event_id\) do nothing/i);
  assert.doesNotMatch(sql, /create_member_community|verify_as1_dominance_canonical_identity|community_roles|instrument_registry/i);
  assert.doesNotMatch(sql, /\bupdate\s+public\.as1_raw_events\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\s+public\.as1_raw_events\b/i);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql.slice(sql.lastIndexOf("from candidates")), /\braw\./i);
});

test("recovery reader preserves the source validator's actual INVALID quality", async () => {
  const source = await readFile(reader, "utf8");
  assert.match(source, /\["GOOD", "LIMITED", "WATCH", "INVALID"\]\.includes\(String\(row\.sensor_quality\)\)/);
});

test("recovery reader access is server-only", async () => {
  const sql = await readFile(readerGrant, "utf8");
  assert.match(sql, /grant select on table public\.as1_recovered_observations to service_role/i);
  assert.doesNotMatch(sql, /grant\s+select[\s\S]*\b(anon|authenticated)\b/i);
});
