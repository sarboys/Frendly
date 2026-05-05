#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/\/scripts\/?$/, "");
const scriptPath = join(root, "scripts", "update-start-graph.sh");

assert.equal(existsSync(scriptPath), true, "update-start-graph script should exist");

const output = execFileSync("bash", [scriptPath], {
  cwd: root,
  env: {
    ...process.env,
    UA_START_GRAPH_DRY_RUN: "1",
  },
  encoding: "utf8",
});

assert.match(output, /GRAPH_DIR=\/Users\/sergeypolyakov\/MyApp/);
assert.match(output, /DASHBOARD_DIR=.*understand-anything-plugin\/packages\/dashboard/);
assert.match(output, /URL=http:\/\/127\.0\.0\.1:5173/);

console.log("update-start-graph test passed");
