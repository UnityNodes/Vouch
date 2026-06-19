import path from "node:path";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "..", "..", ".env") });

export { payAndCall } from "./pay";
export type { PayAndCallResult } from "./pay";
export { loadAgentAccount } from "./wallet";
export { startMcpServer } from "./server";

import { startMcpServer } from "./server";

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`;
if (isDirectRun) {
  startMcpServer().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
