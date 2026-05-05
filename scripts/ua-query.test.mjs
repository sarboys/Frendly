#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/\/scripts\/?$/, "");
const scriptPath = join(root, "scripts", "ua-query.mjs");

assert.equal(existsSync(scriptPath), true, "ua-query script should exist");

const output = execFileSync("node", [scriptPath, "join meetup"], {
  cwd: root,
  encoding: "utf8",
});

assert.match(output, /Context pack/i);
assert.match(output, /Meetup Join and Live/i);
assert.match(output, /backend\/apps\/api\/src\/controllers\/events\.controller\.ts/);
assert.match(output, /backend\/apps\/api\/src\/services\/events\.service\.ts/);
assert.match(output, /Business Logic/i);
assert.doesNotMatch(output, /Partner Content Operations/i);
assert.doesNotMatch(output, /backend\/apps\/api\/src\/services\/partner-portal\.service\.ts/);

const jsonOutput = execFileSync("node", [scriptPath, "--json", "join meetup"], {
  cwd: root,
  encoding: "utf8",
});
const parsed = JSON.parse(jsonOutput);

assert.equal(parsed.query, "join meetup");
assert.ok(parsed.businessFlows.some((flow) => flow.id === "flow:meetup-join-and-live"));
assert.ok(parsed.businessFlows.length <= 2);
assert.ok(parsed.mainFiles.includes("backend/apps/api/src/services/events.service.ts"));

console.log("ua-query test passed");
