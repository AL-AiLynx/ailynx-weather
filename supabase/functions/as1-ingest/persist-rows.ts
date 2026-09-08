import type {IngestRow} from "./validate-envelope.ts";

export type InsertError = {code?: string; message?: string};
export type InsertAttempt = (row: IngestRow) => Promise<{error: InsertError | null}>;

export type PersistSummary = {
  accepted_frames: number;
  duplicate_frames: number;
  rejected_frames: number;
  failures: Array<{client_event_key: string; code: string; message: string}>;
};

export async function persistRows(rows: IngestRow[], insert: InsertAttempt): Promise<PersistSummary> {
  const summary: PersistSummary = {accepted_frames: 0, duplicate_frames: 0, rejected_frames: 0, failures: []};

  for (const row of rows) {
    try {
      const {error} = await insert(row);
      if (!error) {
        summary.accepted_frames += 1;
        continue;
      }
      if (error.code === "23505") {
        summary.duplicate_frames += 1;
        continue;
      }
      summary.rejected_frames += 1;
      summary.failures.push({
        client_event_key: row.client_event_key,
        code: error.code ?? "UNKNOWN_DB_ERROR",
        message: error.message ?? "database insert failed",
      });
    } catch (error) {
      summary.rejected_frames += 1;
      summary.failures.push({
        client_event_key: row.client_event_key,
        code: "INSERT_EXCEPTION",
        message: error instanceof Error ? error.message : "database insert threw an unknown error",
      });
    }
  }

  return summary;
}
