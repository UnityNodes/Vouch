import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReceiptRecord } from "./compliance";

/**
 * Receipt persistence for the live feed. Interface so the JSON-file impl can be
 * swapped for SQLite/Postgres later without touching middleware or the console.
 * (Node only, imported via `@agentcheckout/shared/store`, never from browser code.)
 */
export interface ReceiptStore {
  append(r: ReceiptRecord): Promise<void>;
  list(): Promise<ReceiptRecord[]>;
}

export class JsonReceiptStore implements ReceiptStore {
  constructor(private readonly filePath: string) {}

  private async readAll(): Promise<ReceiptRecord[]> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as ReceiptRecord[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }

  async append(r: ReceiptRecord): Promise<void> {
    const all = await this.readAll();
    all.unshift(r); // newest first
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(all, null, 2), "utf8");
  }

  async list(): Promise<ReceiptRecord[]> {
    return this.readAll();
  }
}

export function defaultReceiptStorePath(): string {
  return process.env.RECEIPTS_PATH ?? path.resolve(process.cwd(), ".data", "receipts.json");
}
