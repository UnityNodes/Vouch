import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { payAndCall } from "./pay";
import { loadAgentAccount } from "./wallet";

/** Start the AgentCheckout MCP server over stdio, exposing the pay_and_call tool. */
export async function startMcpServer(): Promise<void> {
  const server = new McpServer({ name: "agentcheckout", version: "0.1.0" });

  server.registerTool(
    "pay_and_call",
    {
      title: "Pay and call (x402)",
      description:
        "GET a possibly-paid (HTTP 402) resource and auto-pay via x402 on Monad. " +
        "Handles 402 -> sign EIP-3009 authorization -> retry, attaches A-Pass identity proof, " +
        "and settles A-Token. Returns the resource plus the on-chain settlement txHash.",
      inputSchema: {
        url: z.string().url().describe("the resource URL to fetch and pay for"),
        maxAmount: z
          .string()
          .optional()
          .describe("maximum atomic A-Token units willing to spend (omit for no cap)"),
      },
    },
    async ({ url, maxAmount }) => {
      const account = loadAgentAccount();
      const result = await payAndCall({
        url,
        account,
        maxAmount: maxAmount ? BigInt(maxAmount) : undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for the MCP protocol; log to stderr
  console.error("[agentcheckout-mcp] ready on stdio (tool: pay_and_call)");
}
