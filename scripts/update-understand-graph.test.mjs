#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/\/scripts\/?$/, "");
const shellScript = join(root, "scripts", "update-understand-graph.sh");
const knowledgePath = join(root, ".understand-anything", "knowledge-graph.json");
const domainPath = join(root, ".understand-anything", "domain-graph.json");

assert.equal(existsSync(shellScript), true, "update shell script should exist");

execFileSync("bash", [shellScript], {
  cwd: root,
  env: {
    ...process.env,
    UA_SKIP_CORE_BUILD: "1",
  },
  stdio: "pipe",
});

assert.equal(existsSync(knowledgePath), true, "knowledge graph should exist");
assert.equal(existsSync(domainPath), true, "domain graph should exist");

const knowledge = JSON.parse(readFileSync(knowledgePath, "utf8"));
const domain = JSON.parse(readFileSync(domainPath, "utf8"));

assert.ok(
  knowledge.layers.some((layer) => layer.id === "layer:business-logic"),
  "knowledge graph should include Business Logic layer",
);
assert.ok(
  domain.nodes.some((node) => node.type === "domain"),
  "domain graph should include domain nodes",
);
assert.ok(
  domain.nodes.some((node) => node.type === "flow"),
  "domain graph should include flow nodes",
);
assert.ok(
  domain.nodes.some((node) => node.type === "step"),
  "domain graph should include step nodes",
);

console.log("update-understand-graph test passed");
