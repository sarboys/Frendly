FROM node:20-bookworm-slim

RUN corepack enable && apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY backend/package.json backend/pnpm-workspace.yaml backend/tsconfig.base.json backend/jest.preset.js ./
COPY backend/apps/api/package.json ./apps/api/package.json
COPY backend/apps/chat/package.json ./apps/chat/package.json
COPY backend/apps/worker/package.json ./apps/worker/package.json
COPY backend/packages/contracts/package.json ./packages/contracts/package.json
COPY backend/packages/database/package.json ./packages/database/package.json

RUN pnpm install --no-frozen-lockfile

COPY backend ./

RUN pnpm --filter @big-break/database prisma:generate

CMD ["pnpm", "--filter", "@big-break/api", "start"]
