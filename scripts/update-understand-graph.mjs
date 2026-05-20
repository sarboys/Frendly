#!/usr/bin/env node
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { execFileSync } = require("node:child_process");

const projectRoot = process.argv[2] ?? process.cwd();
const pluginRoot =
  process.argv[3] ??
  process.env.UA_PLUGIN_ROOT ??
  `${process.env.HOME}/.codex/understand-anything/understand-anything-plugin`;
const core = await import(pathToFileURL(join(pluginRoot, "packages/core/dist/index.js")).href);

const {
  TreeSitterPlugin,
  PluginRegistry,
  builtinLanguageConfigs,
  registerAllParsers,
  GraphBuilder,
  createIgnoreFilter,
  buildFingerprintStore,
  saveFingerprints,
  validateGraph,
} = core;

const uaDir = join(projectRoot, ".understand-anything");
const intermediateDir = join(uaDir, "intermediate");
const tmpDir = join(uaDir, "tmp");
mkdirSync(uaDir, { recursive: true });
mkdirSync(intermediateDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

const includeRoots = [
  "backend",
  "mobile/lib",
  "mobile/pubspec.yaml",
  "mobile/analysis_options.yaml",
  "mobile/README.md",
  "admin/src",
  "admin/package.json",
  "admin/tsconfig.json",
  "admin/vite.config.ts",
  "admin/vitest.config.ts",
  "admin/Dockerfile",
  "admin/nginx.conf",
  "README.md",
  "Makefile",
  "compose.yaml",
  "compose.prod.yml",
  "compose.telegram-relay.yml",
  "deploy",
  "scripts",
];

const hardExcludes = [
  "/node_modules/",
  "/dist/",
  "/build/",
  "/coverage/",
  "/.turbo/",
  "/.cache/",
  "/.dart_tool/",
  "/Pods/",
  "/.symlinks/",
  "/__tests__/",
];

const ignoredExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".webp",
  ".pdf",
  ".zip",
  ".gz",
  ".mp3",
  ".mp4",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);

const warnings = [];
const ignoreFilter = createIgnoreFilter(projectRoot);
const registry = new PluginRegistry();
const tsPlugin = new TreeSitterPlugin(
  builtinLanguageConfigs.filter((config) => config.treeSitter),
);
await tsPlugin.init();
registry.register(tsPlugin);
registerAllParsers(registry);

function commitHash() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function norm(value) {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function isIncluded(relPath) {
  const path = norm(relPath);
  return includeRoots.some((root) => path === root || path.startsWith(`${root}/`));
}

function isExcluded(relPath, isDir = false) {
  const path = norm(relPath);
  if (!path || !isIncluded(path)) return true;
  if (path.includes("/.") || path.startsWith(".")) return true;
  if (hardExcludes.some((part) => `/${path}/`.includes(part))) return true;
  if (/\.(test|spec)\.(js|mjs|ts|tsx)$/.test(path)) return true;
  if (path.endsWith(".snap") || path.endsWith(".tsbuildinfo") || path.endsWith(".lock")) return true;
  if (basename(path).startsWith(".env")) return !basename(path).endsWith(".example");
  if (ignoredExtensions.has(extname(path).toLowerCase())) return true;
  if (ignoreFilter.isIgnored(path)) return true;
  if (isDir && ignoreFilter.isIgnored(`${path}/`)) return true;
  return false;
}

function isText(absPath) {
  const buffer = readFileSync(absPath);
  if (!buffer.length) return true;
  if (buffer.includes(0)) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let bad = 0;
  for (const byte of sample) {
    if (byte < 7 || (byte > 14 && byte < 32)) bad += 1;
  }
  return bad / sample.length < 0.12;
}

function walk(absDir) {
  const files = [];
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const abs = join(absDir, entry.name);
    const rel = norm(relative(projectRoot, abs));
    if (isExcluded(rel, entry.isDirectory())) continue;
    if (entry.isDirectory()) {
      files.push(...walk(abs));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isText(abs)) continue;
    files.push(rel);
  }
  return files;
}

function scanFiles() {
  const files = new Set();
  for (const root of includeRoots) {
    const abs = join(projectRoot, root);
    if (!existsSync(abs)) continue;
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      for (const file of walk(abs)) files.add(file);
    } else if (stat.isFile() && !isExcluded(root, false) && isText(abs)) {
      files.add(root);
    }
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

function lineCount(content) {
  return content ? content.split("\n").length : 0;
}

function languageFor(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".dart")) return "dart";
  if (lower.endsWith(".prisma")) return "prisma";
  return registry.getLanguageForFile(filePath) ?? "unknown";
}

function categoryFor(filePath) {
  const lower = filePath.toLowerCase();
  const name = basename(lower);
  const ext = extname(lower);
  if ([".md", ".rst", ".txt"].includes(ext)) return "docs";
  if (lower.startsWith("deploy/") || lower.startsWith("scripts/")) return "infra";
  if (lower.startsWith("compose") || name === "dockerfile" || name.includes("nginx")) return "infra";
  if (name === "makefile" || ext === ".sh") return "script";
  if (lower.endsWith(".prisma") || lower.endsWith(".sql")) return "data";
  if (lower.endsWith(".graphql") || lower.endsWith(".proto")) return "data";
  if ([".html", ".css", ".scss"].includes(ext)) return "markup";
  if ([".json", ".yaml", ".yml", ".toml", ".xml"].includes(ext)) return "config";
  if (name.includes("config")) return "config";
  return "code";
}

function nodeTypeFor(filePath, category) {
  const lower = filePath.toLowerCase();
  const name = basename(lower);
  if (category === "docs") return "document";
  if (category === "infra") return "service";
  if (name === "makefile") return "pipeline";
  if (lower.endsWith(".prisma") || lower.endsWith(".graphql") || lower.endsWith(".proto")) return "schema";
  if (lower.endsWith(".sql")) return "table";
  if (category === "config") return "config";
  return "file";
}

function complexityFor(lines, analysis) {
  const count =
    (analysis?.functions?.length ?? 0) +
    (analysis?.classes?.length ?? 0) +
    (analysis?.definitions?.length ?? 0) +
    (analysis?.services?.length ?? 0) +
    (analysis?.endpoints?.length ?? 0);
  if (lines > 350 || count > 18) return "complex";
  if (lines > 120 || count > 6) return "moderate";
  return "simple";
}

function tagsFor(filePath, category, language) {
  const root = filePath.split("/")[0];
  return [...new Set([root, category, language].filter(Boolean))];
}

function fileSummary(filePath, category, analysis) {
  const parts = [];
  if (analysis?.classes?.length) parts.push(`${analysis.classes.length} classes`);
  if (analysis?.functions?.length) parts.push(`${analysis.functions.length} functions`);
  if (analysis?.definitions?.length) parts.push(`${analysis.definitions.length} definitions`);
  if (analysis?.services?.length) parts.push(`${analysis.services.length} services`);
  if (analysis?.endpoints?.length) parts.push(`${analysis.endpoints.length} endpoints`);
  if (parts.length) return `${basename(filePath)} contains ${parts.join(", ")}.`;
  return `${basename(filePath)} is a ${category} file for ${filePath.split("/")[0]}.`;
}

function resolveImport(fromFile, source, fileSet) {
  if (!source?.startsWith(".")) return null;
  const dir = fromFile.split("/").slice(0, -1).join("/");
  const raw = norm(join(dir, source));
  const candidates = [
    raw,
    `${raw}.ts`,
    `${raw}.tsx`,
    `${raw}.js`,
    `${raw}.jsx`,
    `${raw}.dart`,
    `${raw}.json`,
    `${raw}/index.ts`,
    `${raw}/index.tsx`,
    `${raw}/index.js`,
  ];
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function detectFrameworks(files) {
  const frameworks = new Set();
  for (const file of files.filter((item) => item.endsWith("package.json"))) {
    try {
      const json = JSON.parse(readFileSync(join(projectRoot, file), "utf8"));
      const deps = { ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) };
      if (deps["@nestjs/core"]) frameworks.add("NestJS");
      if (deps["@prisma/client"] || deps.prisma) frameworks.add("Prisma");
      if (deps.react) frameworks.add("React");
      if (deps.vite) frameworks.add("Vite");
    } catch (error) {
      warnings.push(`Cannot parse ${file}: ${error.message}`);
    }
  }
  if (files.some((file) => file === "mobile/pubspec.yaml")) frameworks.add("Flutter");
  if (files.some((file) => file.endsWith("schema.prisma"))) frameworks.add("Prisma");
  return [...frameworks].sort((a, b) => a.localeCompare(b));
}

function layerFor(filePath, nodeType) {
  if (["domain", "flow", "step"].includes(nodeType)) return "Business Logic";
  if (filePath.startsWith("mobile/")) return "Mobile Flutter";
  if (filePath.startsWith("admin/")) return "Admin React";
  if (filePath.startsWith("backend/apps/api/")) return "Backend API";
  if (filePath.startsWith("backend/apps/chat/")) return "Backend Realtime";
  if (filePath.startsWith("backend/apps/worker/")) return "Backend Worker";
  if (filePath.startsWith("backend/apps/telegram-relay/")) return "Telegram Relay";
  if (filePath.startsWith("backend/packages/contracts/")) return "Shared Contracts";
  if (filePath.startsWith("backend/packages/database/")) return "Database";
  if (filePath.startsWith("backend/")) return "Backend Shared";
  if (filePath.startsWith("deploy/") || filePath.startsWith("scripts/")) return "Deploy";
  if (filePath.startsWith("compose") || nodeType === "service" || nodeType === "pipeline") return "Deploy";
  return "Root";
}

const layerDescriptions = {
  "Business Logic": "Business domains, flows, and steps extracted from backend, mobile, and admin behavior",
  "Mobile Flutter": "Flutter source and mobile app configuration",
  "Admin React": "Admin React source and app configuration",
  "Backend API": "NestJS REST API controllers, services, modules, DTOs, and guards",
  "Backend Realtime": "WebSocket chat server and realtime flow",
  "Backend Worker": "Background jobs, outbox processing, media checks, and push flow",
  "Telegram Relay": "Telegram relay app",
  "Shared Contracts": "Shared API and realtime contracts",
  Database: "Prisma schema, database helpers, Redis, S3, and persistence code",
  "Backend Shared": "Backend monorepo setup and shared packages",
  Deploy: "Compose, Docker, nginx, server setup, and deploy scripts",
  Root: "Root files that connect the selected apps",
};

function layerId(name) {
  return `layer:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function edge(source, target, type, weight, description) {
  return {
    source,
    target,
    type,
    direction: "forward",
    weight,
    ...(description ? { description } : {}),
  };
}

function stepId(flowId, label) {
  return `step:${flowId.replace(/^flow:/, "")}:${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function domainDefinition() {
  const domains = [
    {
      id: "domain:identity-and-session",
      name: "Identity and Session",
      summary: "Handles phone login, Telegram login, social login, token refresh, logout, and current user lookup.",
      tags: ["auth", "session", "user"],
      complexity: "complex",
      entities: ["User", "Session", "PhoneOtpChallenge", "TelegramLoginSession", "ExternalAuthAccount", "AdminUser", "PartnerAccount"],
      businessRules: [
        "A user needs a valid session token for protected mobile API calls.",
        "Phone OTP, Telegram, Google, and Yandex login all converge into user/session creation.",
        "Admin and partner accounts use separate auth flows from regular users.",
      ],
      crossDomainInteractions: ["Profile and onboarding", "Events and evening routes", "Chat and realtime", "Admin operations"],
    },
    {
      id: "domain:events-and-meetups",
      name: "Events and Meetups",
      summary: "Covers event discovery, event creation, join requests, invites, participation, check-in, live meetup state, after-party, and feedback.",
      tags: ["events", "meetups", "host"],
      complexity: "complex",
      entities: ["Event", "EventParticipant", "EventJoinRequest", "EventAttendance", "EventLiveState", "EventFeedback", "Chat"],
      businessRules: [
        "Event lists filter blocked users and apply access, lifestyle, price, gender, date, and geo constraints.",
        "Capacity is checked before joining or approving requests.",
        "Hosts can approve requests, reject requests, start live state, finish live state, and manually check in participants.",
      ],
      crossDomainInteractions: ["Chat and realtime", "Safety and trust", "Media and stories", "Notifications"],
    },
    {
      id: "domain:evening-routes-and-sessions",
      name: "Evening Routes and Sessions",
      summary: "Handles route templates, route recommendation, session launch, session join flow, step check-ins, partner offer codes, after-party feedback, and route completion.",
      tags: ["evening", "routes", "partners"],
      complexity: "complex",
      entities: ["EveningRouteTemplate", "EveningRoute", "EveningRouteStep", "EveningSession", "EveningSessionParticipant", "EveningJoinRequest", "PartnerOfferCode"],
      businessRules: [
        "Route options are selected by goal, mood, budget, format, and area.",
        "Session privacy controls whether joining is open, request based, or invite based.",
        "Partner offer codes are issued per user, session, step, and offer.",
      ],
      crossDomainInteractions: ["Admin operations", "Chat and realtime", "Partner portal", "Worker automation"],
    },
    {
      id: "domain:chat-and-realtime",
      name: "Chat and Realtime",
      summary: "Owns meetup chats, direct chats, message history, unread counts, read state, WebSocket auth, queued mobile commands, message attachments, and realtime fanout.",
      tags: ["chat", "websocket", "messages"],
      complexity: "complex",
      entities: ["Chat", "ChatMember", "Message", "MessageAttachment", "RealtimeEvent", "OutboxEvent"],
      businessRules: [
        "Users can only read chats they belong to.",
        "Blocked users are filtered from chat previews and message history.",
        "Mobile queues outgoing commands when the socket is unavailable and restores them after reconnect.",
      ],
      crossDomainInteractions: ["Events and meetups", "Evening routes", "Media uploads", "Worker outbox"],
    },
    {
      id: "domain:profile-discovery-and-social",
      name: "Profile Discovery and Social",
      summary: "Covers profile editing, onboarding, public user profiles, people discovery, dating discovery, likes, matches, communities, stories, posters, and shares.",
      tags: ["profile", "discovery", "social"],
      complexity: "complex",
      entities: ["Profile", "ProfilePhoto", "Onboarding", "DatingProfile", "DatingAction", "Match", "Community", "Story", "Poster", "Share"],
      businessRules: [
        "Discovery excludes blocked users and respects viewer state.",
        "Dating actions produce likes, skips, or matches depending on reciprocal state.",
        "Profile media and public share links are mediated through backend ownership checks.",
      ],
      crossDomainInteractions: ["Identity and session", "Events and meetups", "Media uploads", "Safety and trust"],
    },
    {
      id: "domain:safety-trust-and-notifications",
      name: "Safety Trust and Notifications",
      summary: "Handles safety preferences, trusted contacts, reports, user blocks, SOS, verification, notifications, push tokens, and background delivery.",
      tags: ["safety", "trust", "notifications"],
      complexity: "moderate",
      entities: ["SafetySettings", "TrustedContact", "Report", "UserBlock", "SosEvent", "Verification", "Notification", "PushToken"],
      businessRules: [
        "Blocked users are filtered from discovery, events, and chat views.",
        "Push tokens are registered per user/device and can be removed by token or device id.",
        "Reports and SOS actions preserve user context for review and support.",
      ],
      crossDomainInteractions: ["Events and meetups", "Chat and realtime", "Profile discovery", "Worker delivery"],
    },
    {
      id: "domain:admin-and-partner-operations",
      name: "Admin and Partner Operations",
      summary: "Covers admin login, partner account approval, route template management, venue and offer management, partner portal meetups, community content, posters, and featured requests.",
      tags: ["admin", "partner", "operations"],
      complexity: "complex",
      entities: ["AdminUser", "PartnerAccount", "Partner", "Venue", "PartnerOffer", "EveningRouteTemplate", "Poster", "FeaturedRequest"],
      businessRules: [
        "Partner accounts can be approved, rejected, or suspended by admins.",
        "Evening route templates can be drafted, revised, published, or archived.",
        "Partner content goes through create, update, submit, archive, and review states.",
      ],
      crossDomainInteractions: ["Evening routes", "Events and meetups", "Profile discovery", "Partner offer codes"],
    },
  ];

  const flows = [
    {
      id: "flow:phone-and-social-login",
      domain: "domain:identity-and-session",
      name: "Phone and Social Login",
      summary: "User authenticates with phone OTP, Telegram, Google, Yandex, or test shortcut, then receives access and refresh tokens.",
      entryPoint: "POST /auth/phone/request, POST /auth/phone/verify, POST /auth/telegram/verify, POST /auth/google/verify, POST /auth/yandex/verify",
      entryType: "http",
      steps: [
        ["Collect login input", "Phone, Telegram, Google, or Yandex data is accepted by AuthController.", "backend/apps/api/src/controllers/auth.controller.ts", [77, 168]],
        ["Validate identity proof", "AuthService, TelegramAuthService, or SocialAuthService validates the submitted proof.", "backend/apps/api/src/services/auth.service.ts", [65, 439]],
        ["Find or create user", "The backend links the verified identity to a user record.", "backend/apps/api/src/services/auth.service.ts", [574, 617]],
        ["Create session", "A session record and token pair are created for the client.", "backend/apps/api/src/services/auth.service.ts", [618, 699]],
        ["Bootstrap mobile session", "Mobile stores tokens and loads the current user through BackendRepository.", "mobile/lib/shared/data/backend_repository.dart", [197, 300]],
      ],
    },
    {
      id: "flow:event-discovery",
      domain: "domain:events-and-meetups",
      name: "Event Discovery",
      summary: "Mobile requests event lists with filters, search, geo bounds, and pagination. Backend filters blocked users and maps events into cards.",
      entryPoint: "GET /events",
      entryType: "http",
      steps: [
        ["Request filtered list", "EventsController reads filter, search, geo, date, and pagination query params.", "backend/apps/api/src/controllers/events.controller.ts", [9, 47]],
        ["Build query constraints", "EventsService resolves blocked users, viewer gender, filters, cursor, and geo query.", "backend/apps/api/src/services/events.service.ts", [94, 175]],
        ["Load and order events", "Events are loaded through Prisma and optional PostGIS candidates, then ordered and paginated.", "backend/apps/api/src/services/events.service.ts", [176, 284]],
        ["Map event cards", "Event summaries include participant state, attendance, live state, and viewer-specific fields.", "backend/apps/api/src/services/events.service.ts", [176, 284]],
        ["Render mobile surfaces", "Mobile fetches events through BackendRepository and shows tonight, map, search, and event detail screens.", "mobile/lib/shared/data/backend_repository.dart", [358, 409]],
      ],
    },
    {
      id: "flow:meetup-join-and-live",
      domain: "domain:events-and-meetups",
      name: "Meetup Join and Live",
      summary: "User joins or requests access to an event, host reviews requests, participants check in, and the meetup moves through live and after-party states.",
      entryPoint: "POST /events/:eventId/join, POST /host/requests/:requestId/approve, POST /events/:eventId/check-in/confirm",
      entryType: "http",
      steps: [
        ["Join or request", "EventsController routes direct join and join-request calls to EventsService.", "backend/apps/api/src/controllers/events.controller.ts", [54, 66]],
        ["Enforce capacity and access", "EventsService validates blocked users, capacity, event status, and request state.", "backend/apps/api/src/services/events.service.ts", [428, 680]],
        ["Host reviews requests", "HostService approves or rejects join requests from the host dashboard.", "backend/apps/api/src/services/host.service.ts", [372, 557]],
        ["Confirm check-in", "EventsService validates check-in data and writes attendance state.", "backend/apps/api/src/services/events.service.ts", [1508, 1612]],
        ["Run live and after-party", "Live meetup and after-party data are exposed after check-in and meetup progress.", "backend/apps/api/src/services/events.service.ts", [1613, 1779]],
      ],
    },
    {
      id: "flow:evening-route-session",
      domain: "domain:evening-routes-and-sessions",
      name: "Evening Route Session",
      summary: "User resolves a route, launches a session, guests join, steps are checked in or advanced, and the route finishes with after-party state.",
      entryPoint: "POST /evening/routes/resolve, POST /evening/routes/:routeId/launch, POST /evening/sessions/:sessionId/start",
      entryType: "http",
      steps: [
        ["Resolve route", "EveningService validates goal, mood, budget, format, area, then selects a route candidate.", "backend/apps/api/src/services/evening.service.ts", [98, 114]],
        ["Launch route", "EveningService creates a session and prepares route state for the host.", "backend/apps/api/src/services/evening.service.ts", [358, 484]],
        ["Join session", "Session privacy rules decide whether joining is immediate, request based, or blocked.", "backend/apps/api/src/services/evening.service.ts", [660, 882]],
        ["Check in and progress steps", "Participants check in to route steps, then host or user advances, skips, or finishes.", "backend/apps/api/src/services/evening.service.ts", [1103, 1173]],
        ["After-party and feedback", "Finished sessions expose after-party data and accept feedback/photos.", "backend/apps/api/src/services/evening.service.ts", [1237, 1384]],
        ["Mobile route screens", "Flutter screens load route/session state and drive the evening UI.", "mobile/lib/features/evening_routes/presentation/evening_route_detail_screen.dart", [1, 200]],
      ],
    },
    {
      id: "flow:partner-offer-code",
      domain: "domain:evening-routes-and-sessions",
      name: "Partner Offer Code",
      summary: "An evening session step can issue a partner offer code, check code status, and activate public codes.",
      entryPoint: "POST /evening/sessions/:sessionId/steps/:stepId/offers/:offerId/code",
      entryType: "http",
      steps: [
        ["Request code", "EveningController accepts session, step, and offer ids for the current user.", "backend/apps/api/src/controllers/evening.controller.ts", [172, 186]],
        ["Issue code", "PartnerOfferCodeService checks access and creates a code for the user and offer.", "backend/apps/api/src/services/partner-offer-code.service.ts", [70, 153]],
        ["Read code status", "The user can query code status from the authenticated evening API.", "backend/apps/api/src/services/partner-offer-code.service.ts", [154, 188]],
        ["Activate public code", "Public code activation validates and marks the code as used.", "backend/apps/api/src/services/partner-offer-code.service.ts", [189, 260]],
        ["Show QR in mobile", "Mobile route screens include partner offer QR entry points.", "mobile/lib/features/evening_routes/presentation/partner_offer_qr_screen.dart", [1, 200]],
      ],
    },
    {
      id: "flow:message-sync",
      domain: "domain:chat-and-realtime",
      name: "Message Sync",
      summary: "Mobile opens a chat, loads history through REST, sends commands over WebSocket, stores offline commands, and marks messages read.",
      entryPoint: "GET /chats/:chatId/messages and WebSocket chat commands",
      entryType: "http",
      steps: [
        ["Load chat list", "ChatsService lists meetup or direct chats for the current user and filters blocked users.", "backend/apps/api/src/services/chats.service.ts", [29, 450]],
        ["Load messages", "ChatsService returns paginated message history with attachments and sender data.", "backend/apps/api/src/services/chats.service.ts", [451, 545]],
        ["Connect socket", "ChatSocketClient opens WebSocket auth and reconnect recovery on mobile.", "mobile/lib/app/core/network/chat_socket_client.dart", [90, 321]],
        ["Send queued command", "Mobile persists outgoing commands and restores them after reconnect.", "mobile/lib/app/core/network/chat_socket_client.dart", [509, 581]],
        ["Fan out realtime events", "ChatServerService handles live commands and broadcasts updates.", "backend/apps/chat/src/chat-server.service.ts", [1, 220]],
        ["Mark read", "REST and socket state update read cursor and unread counts.", "backend/apps/api/src/services/chats.service.ts", [546, 620]],
      ],
    },
    {
      id: "flow:profile-and-onboarding",
      domain: "domain:profile-discovery-and-social",
      name: "Profile and Onboarding",
      summary: "User completes onboarding, edits profile fields, uploads photos, and exposes a viewer-safe profile to other users.",
      entryPoint: "GET /onboarding/me, PUT /onboarding/me, PATCH /profile/me",
      entryType: "http",
      steps: [
        ["Load onboarding", "OnboardingService loads current onboarding state and session data.", "backend/apps/api/src/services/onboarding.service.ts", [163, 189]],
        ["Validate contact availability", "Onboarding can check phone/contact availability before saving.", "backend/apps/api/src/services/onboarding.service.ts", [190, 249]],
        ["Save onboarding", "OnboardingService persists profile and preference data.", "backend/apps/api/src/services/onboarding.service.ts", [250, 330]],
        ["Update profile", "ProfileService updates current user's profile fields.", "backend/apps/api/src/services/profile.service.ts", [56, 84]],
        ["Manage photos", "ProfileService handles avatar and profile photo upload, ordering, primary photo, and delete.", "backend/apps/api/src/services/profile.service.ts", [85, 420]],
        ["Mobile onboarding UI", "Flutter onboarding collects contact, birthday, location, and preferences.", "mobile/lib/features/onboarding/presentation/onboarding_screen.dart", [153, 222]],
      ],
    },
    {
      id: "flow:dating-match",
      domain: "domain:profile-discovery-and-social",
      name: "Dating Match",
      summary: "Users browse dating profiles, review likes, send dating actions, and receive matches when actions become reciprocal.",
      entryPoint: "GET /dating/discover, GET /dating/likes, POST /dating/actions",
      entryType: "http",
      steps: [
        ["List discover cards", "DatingService loads eligible profiles for the viewer.", "backend/apps/api/src/services/dating.service.ts", [130, 211]],
        ["List incoming likes", "DatingService returns users who liked the viewer.", "backend/apps/api/src/services/dating.service.ts", [212, 278]],
        ["Record action", "DatingService saves like, skip, or other action and computes match result.", "backend/apps/api/src/services/dating.service.ts", [279, 360]],
        ["Show mobile swipe flow", "DatingScreen sends user action from the mobile card UI.", "mobile/lib/features/dating/presentation/dating_screen.dart", [460, 520]],
        ["List matches", "MatchesService exposes current matches.", "backend/apps/api/src/services/matches.service.ts", [16, 80]],
      ],
    },
    {
      id: "flow:safety-and-blocking",
      domain: "domain:safety-trust-and-notifications",
      name: "Safety and Blocking",
      summary: "User configures safety data, manages trusted contacts, reports incidents, blocks users, and can fire SOS.",
      entryPoint: "GET /safety/me, POST /reports, POST /blocks, POST /safety/sos",
      entryType: "http",
      steps: [
        ["Load safety state", "SafetyService returns current safety settings and trusted contacts.", "backend/apps/api/src/services/safety.service.ts", [13, 92]],
        ["Manage trusted contacts", "SafetyService creates and deletes trusted contacts.", "backend/apps/api/src/services/safety.service.ts", [93, 156]],
        ["Create report", "SafetyService records reports from the current user.", "backend/apps/api/src/services/safety.service.ts", [157, 282]],
        ["Block user", "SafetyService creates blocks that other domains use for filtering.", "backend/apps/api/src/services/safety.service.ts", [283, 352]],
        ["Fire SOS", "SafetyService creates an SOS event with current user context.", "backend/apps/api/src/services/safety.service.ts", [353, 410]],
        ["Mobile safety hub", "SafetyHubScreen exposes settings, reports, blocks, and SOS UI.", "mobile/lib/features/safety/presentation/safety_hub_screen.dart", [138, 293]],
      ],
    },
    {
      id: "flow:push-notification-delivery",
      domain: "domain:safety-trust-and-notifications",
      name: "Push Notification Delivery",
      summary: "Mobile registers push tokens, backend stores them, worker reads outbox events, and providers dispatch push messages.",
      entryPoint: "POST /push-tokens and worker outbox loop",
      entryType: "event",
      steps: [
        ["Register token", "NotificationsService stores push token and device metadata.", "backend/apps/api/src/services/notifications.service.ts", [150, 208]],
        ["Create outbox event", "Business services create outbox events for async delivery.", "backend/packages/database/src/outbox.ts", [1, 120]],
        ["Poll worker", "WorkerService reads and processes outbox events.", "backend/apps/worker/src/worker.service.ts", [164, 260]],
        ["Dispatch provider", "Push providers send platform-specific push messages.", "backend/apps/worker/src/push.providers.ts", [1, 120]],
        ["Receive on mobile", "Mobile push token service keeps device token state in sync.", "mobile/lib/app/core/device/app_push_token_service.dart", [1, 160]],
      ],
    },
    {
      id: "flow:admin-route-template-lifecycle",
      domain: "domain:admin-and-partner-operations",
      name: "Admin Route Template Lifecycle",
      summary: "Admin creates evening route templates, edits steps, publishes, archives, revises, and can generate AI drafts.",
      entryPoint: "GET/POST/PATCH /admin/evening/route-templates and /admin/evening/ai",
      entryType: "http",
      steps: [
        ["Create brief", "AdminEveningAiService creates a route generation brief.", "backend/apps/api/src/services/admin-evening-ai.service.ts", [66, 104]],
        ["Generate drafts", "AdminEveningAiService generates candidate route drafts from the brief.", "backend/apps/api/src/services/admin-evening-ai.service.ts", [105, 199]],
        ["Convert draft", "A generated draft can become a route template.", "backend/apps/api/src/services/admin-evening-ai.service.ts", [200, 260]],
        ["Edit template", "AdminEveningRouteService creates, updates, and revises templates.", "backend/apps/api/src/services/admin-evening-route.service.ts", [34, 134]],
        ["Publish or archive", "AdminEveningRouteService moves templates into published or archived state.", "backend/apps/api/src/services/admin-evening-route.service.ts", [135, 219]],
        ["Admin UI", "Admin EveningRoutes page and RouteStepEditor drive this workflow.", "admin/src/admin/pages/EveningRoutes.tsx", [1, 220]],
      ],
    },
    {
      id: "flow:partner-content-operations",
      domain: "domain:admin-and-partner-operations",
      name: "Partner Content Operations",
      summary: "Partner portal manages meetups, communities, posters, media, and featured requests while admin manages partner account status.",
      entryPoint: "Partner portal and admin partner account endpoints",
      entryType: "http",
      steps: [
        ["Review partner account", "PartnerAuthService and admin partner controllers approve, reject, or suspend partner accounts.", "backend/apps/api/src/services/partner-auth.service.ts", [171, 252]],
        ["Create partner meetup", "PartnerPortalService creates and updates meetups owned by the partner.", "backend/apps/api/src/services/partner-portal.service.ts", [34, 231]],
        ["Review join requests", "PartnerPortalService lists and reviews meetup join requests.", "backend/apps/api/src/services/partner-portal.service.ts", [263, 351]],
        ["Manage community content", "PartnerPortalService creates communities, news, and media.", "backend/apps/api/src/services/partner-portal.service.ts", [352, 538]],
        ["Manage posters and featured requests", "PartnerPortalService creates, submits, updates, and archives poster and featured request content.", "backend/apps/api/src/services/partner-portal.service.ts", [539, 690]],
      ],
    },
  ];

  const crossDomainEdges = [
    ["domain:identity-and-session", "domain:events-and-meetups", "Authenticated users browse, create, and join events."],
    ["domain:identity-and-session", "domain:chat-and-realtime", "Chat socket and REST history require current user identity."],
    ["domain:events-and-meetups", "domain:chat-and-realtime", "Meetup participation creates or exposes meetup chat context."],
    ["domain:evening-routes-and-sessions", "domain:chat-and-realtime", "Evening routes can share step actions and session context into chat."],
    ["domain:admin-and-partner-operations", "domain:evening-routes-and-sessions", "Admin route templates and partner offers feed the user evening route flow."],
    ["domain:safety-trust-and-notifications", "domain:events-and-meetups", "Blocks and reports affect event visibility, participation, and review flows."],
    ["domain:safety-trust-and-notifications", "domain:chat-and-realtime", "Blocks and unread/push delivery shape chat visibility and notifications."],
    ["domain:profile-discovery-and-social", "domain:events-and-meetups", "Profiles, stories, posters, and shares enrich event discovery and detail pages."],
  ];

  return { domains, flows, crossDomainEdges };
}

function buildDomainGraph(baseProject) {
  const { domains, flows, crossDomainEdges } = domainDefinition();
  const domainNodes = domains.map((domain) => ({
    id: domain.id,
    type: "domain",
    name: domain.name,
    summary: domain.summary,
    tags: domain.tags,
    complexity: domain.complexity,
    domainMeta: {
      entities: domain.entities,
      businessRules: domain.businessRules,
      crossDomainInteractions: domain.crossDomainInteractions,
    },
  }));

  const flowNodes = flows.map((flow) => {
    const domain = domains.find((item) => item.id === flow.domain);
    return {
      id: flow.id,
      type: "flow",
      name: flow.name,
      summary: flow.summary,
      tags: ["business-flow", ...(domain?.tags ?? [])],
      complexity: flow.steps.length >= 6 ? "complex" : "moderate",
      domainMeta: {
        entryPoint: flow.entryPoint,
        entryType: flow.entryType,
      },
    };
  });

  const stepNodes = flows.flatMap((flow) => {
    const domain = domains.find((item) => item.id === flow.domain);
    return flow.steps.map(([name, summary, filePath, lineRange]) => ({
      id: stepId(flow.id, name),
      type: "step",
      name,
      summary,
      tags: ["business-step", ...(domain?.tags ?? [])],
      complexity: "moderate",
      filePath,
      lineRange,
    }));
  });

  const domainEdges = [
    ...flows.map((flow) => edge(flow.domain, flow.id, "contains_flow", 1)),
    ...flows.flatMap((flow) => {
      const count = flow.steps.length;
      return flow.steps.map(([name], index) =>
        edge(
          flow.id,
          stepId(flow.id, name),
          "flow_step",
          Math.max(0.1, Number(((index + 1) / count).toFixed(1))),
        ),
      );
    }),
    ...crossDomainEdges.map(([source, target, description]) =>
      edge(source, target, "cross_domain", 0.6, description),
    ),
  ];

  return {
    version: "1.0.0",
    project: {
      ...baseProject,
      name: "Frendly Business Logic",
      description: "Business domain map for backend, mobile, and admin flows.",
    },
    nodes: [...domainNodes, ...flowNodes, ...stepNodes],
    edges: domainEdges,
    layers: [],
    tour: [],
  };
}

function buildTour(graph) {
  const exists = new Set(graph.nodes.map((node) => node.id));
  const pick = (prefix, limit) =>
    graph.nodes
      .filter((node) => node.filePath?.startsWith(prefix) && ["file", "config", "document", "service", "schema"].includes(node.type))
      .slice(0, limit)
      .map((node) => node.id);
  const steps = [];
  const push = (title, description, nodeIds) => {
    const filtered = [...new Set(nodeIds)].filter((id) => exists.has(id));
    if (filtered.length) steps.push({ order: steps.length + 1, title, description, nodeIds: filtered });
  };
  push("Business Logic", "Start with the domain layer, then use the separate Domain view for full flow details.", [
    "domain:identity-and-session",
    "domain:events-and-meetups",
    "domain:evening-routes-and-sessions",
    "domain:chat-and-realtime",
  ]);
  push("Backend Entry", "Review backend apps, shared contracts, and database schema.", [
    ...pick("backend/apps/api/src/", 6),
    ...pick("backend/apps/chat/src/", 3),
    ...pick("backend/apps/worker/src/", 3),
    ...pick("backend/packages/contracts/src/", 2),
    ...pick("backend/packages/database/prisma/", 2),
  ]);
  push("Mobile Client", "Inspect Flutter app shell, navigation, features, and shared data layer.", [
    "file:mobile/lib/main.dart",
    "file:mobile/lib/app/app.dart",
    "file:mobile/lib/app/navigation/app_router.dart",
    ...pick("mobile/lib/shared/", 5),
  ]);
  push("Admin Client", "Review admin routes, layout, pages, and API client.", [
    ...pick("admin/src/", 8),
  ]);
  push("Runtime Link", "Finish with compose files, Dockerfiles, nginx, and deploy scripts.", [
    "service:compose.yaml",
    "service:compose.prod.yml",
    "service:backend/Dockerfile",
    "service:admin/Dockerfile",
    ...pick("scripts/", 4),
    ...pick("deploy/", 4),
  ]);
  return steps;
}

function validateOrThrow(name, graph) {
  const result = validateGraph(graph);
  if (!result.success) {
    throw new Error(`${name} validation failed: ${result.fatal ?? JSON.stringify(result.issues)}`);
  }
}

const files = scanFiles();
const fileSet = new Set(files);
const analyses = new Map();
const importMap = {};
const scan = [];

for (const file of files) {
  const content = readFileSync(join(projectRoot, file), "utf8");
  const language = languageFor(file);
  const fileCategory = categoryFor(file);
  let analysis = null;
  try {
    analysis = registry.analyzeFile(file, content);
  } catch (error) {
    warnings.push(`Parser failed for ${file}: ${error.message}`);
  }
  analyses.set(file, analysis);
  scan.push({ path: file, sizeLines: lineCount(content), fileCategory, language });

  const imports = [];
  for (const item of analysis?.imports ?? []) {
    const target = resolveImport(file, item.source, fileSet);
    if (target) imports.push(target);
  }
  importMap[file] = [...new Set(imports)];
}

const gitCommitHash = commitHash();
const analyzedAt = new Date().toISOString();
const builder = new GraphBuilder("Frendly backend-mobile-admin", gitCommitHash);

for (const item of scan) {
  const analysis = analyses.get(item.path);
  const common = {
    summary: fileSummary(item.path, item.fileCategory, analysis),
    tags: tagsFor(item.path, item.fileCategory, item.language),
    complexity: complexityFor(item.sizeLines, analysis),
  };
  const type = nodeTypeFor(item.path, item.fileCategory);
  if (type === "file") {
    if (analysis) {
      const summaries = {};
      for (const fn of analysis.functions ?? []) summaries[fn.name] = `${fn.name} in ${basename(item.path)}.`;
      for (const cls of analysis.classes ?? []) summaries[cls.name] = `${cls.name} in ${basename(item.path)}.`;
      builder.addFileWithAnalysis(item.path, analysis, {
        ...common,
        fileSummary: common.summary,
        summaries,
      });
    } else {
      builder.addFile(item.path, common);
    }
  } else {
    builder.addNonCodeFileWithAnalysis(item.path, {
      ...common,
      nodeType: type,
      definitions: analysis?.definitions ?? [],
      services: analysis?.services ?? [],
      endpoints: analysis?.endpoints ?? [],
      steps: analysis?.steps ?? [],
      resources: analysis?.resources ?? [],
      sections: analysis?.sections ?? [],
    });
  }
}

let graph = builder.build();
graph.project = {
  name: "Frendly backend-mobile-admin",
  description: "Focused graph for backend, mobile Flutter app, admin app, business logic, and their runtime/deploy links.",
  languages: [...new Set(scan.map((item) => item.language).filter((lang) => lang !== "unknown"))].sort(),
  frameworks: detectFrameworks(files),
  analyzedAt,
  gitCommitHash,
};

for (const [source, targets] of Object.entries(importMap)) {
  for (const target of targets) {
    graph.edges.push(edge(`file:${source}`, `file:${target}`, "imports", 0.7));
  }
}

for (const node of graph.nodes) {
  if (!node.tags?.length) node.tags = tagsFor(node.filePath ?? node.name, node.type, "structure");
  if (!node.summary) node.summary = `${node.name} in ${node.filePath ?? "graph"}.`;
}

const domainGraph = buildDomainGraph(graph.project);
graph.nodes.push(...domainGraph.nodes);
graph.edges.push(...domainGraph.edges);

const nodeIds = new Set();
graph.nodes = graph.nodes.filter((node) => {
  if (nodeIds.has(node.id)) return false;
  nodeIds.add(node.id);
  return true;
});

const edgeKeys = new Set();
graph.edges = graph.edges.filter((item) => {
  if (!nodeIds.has(item.source) || !nodeIds.has(item.target)) return false;
  const key = `${item.source}|${item.target}|${item.type}`;
  if (edgeKeys.has(key)) return false;
  edgeKeys.add(key);
  return true;
});

const layers = new Map();
for (const node of graph.nodes) {
  if (!["file", "config", "document", "service", "pipeline", "table", "schema", "resource", "endpoint", "domain", "flow", "step"].includes(node.type)) continue;
  const name = layerFor(node.filePath ?? node.id, node.type);
  if (!layers.has(name)) layers.set(name, []);
  layers.get(name).push(node.id);
}
graph.layers = [...layers.entries()].map(([name, nodeIds]) => ({
  id: layerId(name),
  name,
  description: layerDescriptions[name] ?? name,
  nodeIds,
}));
graph.layers.sort((a, b) => {
  if (a.id === "layer:business-logic") return -1;
  if (b.id === "layer:business-logic") return 1;
  return a.name.localeCompare(b.name);
});
graph.tour = buildTour(graph);

validateOrThrow("knowledge graph", graph);
validateOrThrow("domain graph", domainGraph);

const categoryCounts = scan.reduce((acc, item) => {
  acc[item.fileCategory] = (acc[item.fileCategory] ?? 0) + 1;
  return acc;
}, {});
const nodeTypeCounts = graph.nodes.reduce((acc, node) => {
  acc[node.type] = (acc[node.type] ?? 0) + 1;
  return acc;
}, {});
const edgeTypeCounts = graph.edges.reduce((acc, item) => {
  acc[item.type] = (acc[item.type] ?? 0) + 1;
  return acc;
}, {});

writeFileSync(join(intermediateDir, "scan-result.json"), JSON.stringify({
  projectName: graph.project.name,
  projectDescription: graph.project.description,
  languages: graph.project.languages,
  frameworks: graph.project.frameworks,
  files: scan,
  importMap,
}, null, 2));
writeFileSync(join(intermediateDir, "assembled-graph.json"), JSON.stringify(graph, null, 2));
writeFileSync(join(uaDir, "knowledge-graph.json"), JSON.stringify(graph, null, 2));
writeFileSync(join(uaDir, "domain-graph.json"), JSON.stringify(domainGraph, null, 2));
writeFileSync(join(uaDir, "meta.json"), JSON.stringify({
  lastAnalyzedAt: graph.project.analyzedAt,
  gitCommitHash: graph.project.gitCommitHash,
  version: "1.0.0",
  analyzedFiles: scan.length,
}, null, 2));

try {
  const fingerprintFiles = scan
    .filter((item) => ["code", "script", "markup"].includes(item.fileCategory))
    .filter((item) => item.language !== "dart")
    .map((item) => item.path);
  saveFingerprints(
    projectRoot,
    buildFingerprintStore(projectRoot, fingerprintFiles, registry, gitCommitHash),
  );
} catch (error) {
  warnings.push(`Fingerprint generation failed: ${error.message}`);
  writeFileSync(join(uaDir, "fingerprints.json"), JSON.stringify({
    files: {},
    warning: error.message,
  }, null, 2));
}

const summary = {
  project: {
    name: graph.project.name,
    description: graph.project.description,
  },
  filesAnalyzed: scan.length,
  fileCategories: categoryCounts,
  nodeTypes: nodeTypeCounts,
  edgeTypes: edgeTypeCounts,
  layers: graph.layers.map((layer) => layer.name),
  tourSteps: graph.tour.length,
  businessLogic: {
    domains: domainGraph.nodes.filter((node) => node.type === "domain").length,
    flows: domainGraph.nodes.filter((node) => node.type === "flow").length,
    steps: domainGraph.nodes.filter((node) => node.type === "step").length,
    domainGraphPath: join(uaDir, "domain-graph.json"),
  },
  review: {
    issues: [],
    warnings,
  },
  outputPath: join(uaDir, "knowledge-graph.json"),
};

writeFileSync(join(uaDir, "summary.json"), JSON.stringify(summary, null, 2));
rmSync(intermediateDir, { recursive: true, force: true });
rmSync(tmpDir, { recursive: true, force: true });

console.log(JSON.stringify({
  filesAnalyzed: summary.filesAnalyzed,
  nodes: graph.nodes.length,
  edges: graph.edges.length,
  businessLogic: summary.businessLogic,
  warnings: warnings.length,
  outputPath: summary.outputPath,
}, null, 2));
