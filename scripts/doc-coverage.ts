#!/usr/bin/env -S deno run -A
/**
 * Calculate documentation coverage across all entrypoints
 */

interface DocNode {
  kind: string;
  name: string;
  jsDoc?: string;
}

async function getDocCoverage(entrypoint: string): Promise<{
  total: number;
  documented: number;
  coverage: number;
}> {
  const cmd = new Deno.Command("deno", {
    args: ["doc", "--json", entrypoint],
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout } = await cmd.output();
  const json = JSON.parse(new TextDecoder().decode(stdout));

  // Extract nodes array from the response
  const nodes = json.nodes || [];

  // Filter out imports and module docs, count documented symbols
  const symbols = nodes.filter((node: DocNode) =>
    node.kind !== "import" && node.kind !== "moduleDoc"
  );
  const documented = symbols.filter((node: DocNode) =>
    node.jsDoc && Object.keys(node.jsDoc).length > 0
  );

  const total = symbols.length;
  const docCount = documented.length;
  const coverage = total > 0 ? Math.floor((docCount / total) * 100) : 0;

  return { total, documented: docCount, coverage };
}

// Get all entrypoints from deno.json
const denoJson = JSON.parse(
  await Deno.readTextFile(new URL("../deno.json", import.meta.url)),
);

console.log("📚 Documentation Coverage\n");

let totalSymbols = 0;
let totalDocumented = 0;

for (
  const [name, path] of Object.entries(
    denoJson.exports as Record<string, string>,
  )
) {
  const entrypoint = path.replace("./", "");
  const stats = await getDocCoverage(entrypoint);

  totalSymbols += stats.total;
  totalDocumented += stats.documented;

  const emoji = stats.coverage >= 80
    ? "✅"
    : stats.coverage >= 60
    ? "⚠️"
    : "❌";
  console.log(
    `${emoji} ${
      name.padEnd(10)
    } ${stats.documented}/${stats.total} (${stats.coverage}%)`,
  );
}

const overallCoverage = Math.floor((totalDocumented / totalSymbols) * 100);
const overallEmoji = overallCoverage >= 80
  ? "✅"
  : overallCoverage >= 60
  ? "⚠️"
  : "❌";

console.log(
  `\n${overallEmoji} Overall: ${totalDocumented}/${totalSymbols} (${overallCoverage}%)`,
);

// Exit with error if coverage is too low
if (overallCoverage < 80) {
  console.error(`\n❌ Documentation coverage is below 80% threshold`);
  Deno.exit(1);
}
