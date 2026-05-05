#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const query = args.filter((arg) => arg !== "--json").join(" ").trim();

if (!query) {
  console.error("Usage: node scripts/ua-query.mjs [--json] \"query\"");
  process.exit(1);
}

const projectRoot = process.cwd();
const uaDir = join(projectRoot, ".understand-anything");
const summaryPath = join(uaDir, "summary.json");
const domainPath = join(uaDir, "domain-graph.json");
const knowledgePath = join(uaDir, "knowledge-graph.json");

for (const path of [summaryPath, domainPath, knowledgePath]) {
  if (!existsSync(path)) {
    console.error(`Missing ${path}. Run bash scripts/update-understand-graph.sh first.`);
    process.exit(1);
  }
}

const summary = readJson(summaryPath);
const domainGraph = readJson(domainPath);
const knowledgeGraph = readJson(knowledgePath);
const tokens = tokenize(query);
const phrase = normalize(query);

const domainNodes = new Map(domainGraph.nodes.map((node) => [node.id, node]));
const knowledgeNodes = new Map(knowledgeGraph.nodes.map((node) => [node.id, node]));

const domainMatches = rankNodes(domainGraph.nodes, tokens, phrase)
  .filter((match) => match.score > 0);
const knowledgeMatches = rankNodes(knowledgeGraph.nodes, tokens, phrase)
  .filter((match) => match.score > 0);
const focusedKnowledgeMatches = focusMatches(knowledgeMatches, 0.6);

const businessFlows = pickBusinessFlows(domainMatches, domainGraph.edges, domainNodes).slice(0, 2);
const steps = uniqueBy(
  businessFlows.flatMap((flow) => flowSteps(flow.id, domainGraph.edges, domainNodes)),
  (step) => step.id,
).slice(0, 12);

const businessDomains = uniqueBy(
  businessFlows.flatMap((flow) => parentDomains(flow.id, domainGraph.edges, domainNodes)),
  (domain) => domain.id,
);

const mainFiles = collectMainFiles(steps, focusedKnowledgeMatches).slice(0, 10);
const relatedFiles = collectRelatedFiles(mainFiles, knowledgeGraph.edges, knowledgeNodes).slice(0, 14);
const layers = collectLayers([...businessFlows, ...steps], mainFiles, knowledgeGraph.layers).slice(0, 8);

const pack = {
  query,
  project: summary.project,
  layers,
  businessDomains: businessDomains.map(cleanNode),
  businessFlows: businessFlows.map(cleanNode),
  steps: steps.map(cleanNode),
  mainFiles,
  relatedFiles,
};

if (jsonMode) {
  console.log(JSON.stringify(pack, null, 2));
} else {
  console.log(formatPack(pack));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё/_\-.]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  const seen = new Set();
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 2)
    .filter((token) => {
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

function searchableText(node) {
  return normalize([
    node.id,
    node.type,
    node.name,
    node.summary,
    node.filePath,
    ...(node.tags ?? []),
  ].join(" "));
}

function rankNodes(nodes, queryTokens, queryPhrase) {
  return nodes
    .map((node) => {
      const text = searchableText(node);
      let score = 0;

      if (queryPhrase && text.includes(queryPhrase)) score += 8;
      for (const token of queryTokens) {
        if (text.includes(token)) score += 2;
        if (normalize(node.name).includes(token)) score += 2;
        if ((node.tags ?? []).some((tag) => normalize(tag).includes(token))) score += 1;
      }

      if (node.type === "flow") score += 3;
      if (node.type === "step") score += 2;
      if (node.type === "domain") score += 1;
      if (node.type === "file") score += 1;

      return { node, score };
    })
    .sort((a, b) => b.score - a.score || String(a.node.id).localeCompare(String(b.node.id)));
}

function pickBusinessFlows(matches, edges, nodesById) {
  const directFullMatches = matches
    .filter((match) => match.node.type === "flow")
    .filter((match) => tokens.every((token) => searchableText(match.node).includes(token)));
  if (directFullMatches.length) {
    return directFullMatches.map((match) => match.node);
  }

  const flowScores = new Map();

  function addFlow(flow, score) {
    const current = flowScores.get(flow.id);
    if (!current || score > current.score) {
      flowScores.set(flow.id, { node: flow, score });
    }
  }

  for (const match of matches) {
    if (match.node.type === "flow") {
      addFlow(match.node, match.score);
      continue;
    }

    if (match.node.type === "step") {
      const flowEdge = edges.find((edge) => edge.target === match.node.id && edge.type === "flow_step");
      const flow = flowEdge ? nodesById.get(flowEdge.source) : null;
      if (flow?.type === "flow") addFlow(flow, match.score);
      continue;
    }

    if (match.node.type === "domain") {
      const childFlows = edges
        .filter((edge) => edge.source === match.node.id && edge.type === "contains_flow")
        .map((edge) => nodesById.get(edge.target))
        .filter((node) => node?.type === "flow");
      for (const flow of childFlows) addFlow(flow, match.score * 0.7);
    }
  }

  const ranked = [...flowScores.values()].sort((a, b) => b.score - a.score);
  const minScore = ranked.length ? ranked[0].score * 0.6 : 0;
  return ranked
    .filter((item) => item.score >= minScore)
    .map((item) => item.node);
}

function focusMatches(matches, ratio) {
  if (!matches.length) return [];
  const minScore = matches[0].score * ratio;
  return matches.filter((match) => match.score >= minScore);
}

function flowSteps(flowId, edges, nodesById) {
  return edges
    .filter((edge) => edge.source === flowId && edge.type === "flow_step")
    .sort((a, b) => Number(a.weight ?? 0) - Number(b.weight ?? 0))
    .map((edge) => nodesById.get(edge.target))
    .filter(Boolean);
}

function parentDomains(flowId, edges, nodesById) {
  return edges
    .filter((edge) => edge.target === flowId && edge.type === "contains_flow")
    .map((edge) => nodesById.get(edge.source))
    .filter((node) => node?.type === "domain");
}

function collectMainFiles(stepsList, matches) {
  const files = [];

  for (const step of stepsList) {
    if (step.filePath) files.push(step.filePath);
  }

  if (files.length) return uniqueStrings(files);

  for (const match of matches) {
    const node = match.node;
    if (node.filePath) files.push(node.filePath);
  }

  return uniqueStrings(files);
}

function collectRelatedFiles(mainFilesList, edges, nodesById) {
  const mainFileIds = new Set(mainFilesList.map((file) => `file:${file}`));
  const files = [];

  for (const edge of edges) {
    const sourceIsMain = mainFileIds.has(edge.source);
    const targetIsMain = mainFileIds.has(edge.target);
    if (!sourceIsMain && !targetIsMain) continue;

    const otherId = sourceIsMain ? edge.target : edge.source;
    const node = nodesById.get(otherId);
    if (node?.filePath && !mainFilesList.includes(node.filePath)) {
      files.push(node.filePath);
    }
  }

  return uniqueStrings(files);
}

function collectLayers(nodes, files, layersList) {
  const ids = new Set(nodes.map((node) => node.id));
  for (const file of files) ids.add(`file:${file}`);

  return layersList
    .filter((layer) => (layer.nodeIds ?? []).some((id) => ids.has(id)))
    .map((layer) => layer.name);
}

function cleanNode(node) {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    summary: node.summary,
    filePath: node.filePath ?? null,
    tags: node.tags ?? [],
  };
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function uniqueStrings(items) {
  return uniqueBy(items.filter(Boolean), (item) => item);
}

function formatPack(data) {
  const lines = [];
  lines.push(`Context pack: ${data.query}`);
  lines.push(`Project: ${data.project?.name ?? "unknown"}`);

  if (data.layers.length) {
    lines.push("");
    lines.push("Layers:");
    for (const layer of data.layers) lines.push(`- ${layer}`);
  }

  if (data.businessDomains.length) {
    lines.push("");
    lines.push("Business domains:");
    for (const domain of data.businessDomains) {
      lines.push(`- ${domain.name}: ${domain.summary}`);
    }
  }

  if (data.businessFlows.length) {
    lines.push("");
    lines.push("Business flows:");
    for (const flow of data.businessFlows) {
      lines.push(`- ${flow.name}: ${flow.summary}`);
    }
  }

  if (data.steps.length) {
    lines.push("");
    lines.push("Steps:");
    data.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.name}`);
      lines.push(`   ${step.filePath ?? "no file"}`);
      lines.push(`   ${step.summary}`);
    });
  }

  if (data.mainFiles.length) {
    lines.push("");
    lines.push("Main files:");
    for (const file of data.mainFiles) lines.push(`- ${file}`);
  }

  if (data.relatedFiles.length) {
    lines.push("");
    lines.push("Related files:");
    for (const file of data.relatedFiles) lines.push(`- ${file}`);
  }

  if (!data.businessFlows.length && !data.mainFiles.length) {
    lines.push("");
    lines.push("No strong graph match. Try a domain word like meetup, chat, auth, route, admin, profile.");
  }

  return lines.join("\n");
}
