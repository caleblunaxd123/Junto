# Build only API + shared workspaces; Expo and development watchers never enter the runtime.
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json

FROM base AS build
RUN npm ci --workspace=apps/api --workspace=packages/shared --include-workspace-root --ignore-scripts --no-audit
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
RUN npx --no-install prisma generate --schema apps/api/prisma/schema.prisma && npm run build:api

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
COPY ops/contabo/prepare-runtime.cjs /opt/build/prepare-runtime.cjs
# npm otherwise retains orphan development packages from the mobile workspace's lock graph.
# Recalculate only graph membership, then assert that package versions have not changed.
RUN node /opt/build/prepare-runtime.cjs && npm install --package-lock-only --ignore-scripts --no-audit \
    && node /opt/build/prepare-runtime.cjs --verify \
    && npm ci --omit=dev --workspace=apps/api --workspace=packages/shared --include-workspace-root --ignore-scripts --no-audit
COPY --from=build /app/node_modules/.prisma/ node_modules/.prisma/
COPY --from=build /app/node_modules/@prisma/engines/ node_modules/@prisma/engines/
COPY --from=build /app/packages/shared/ packages/shared/
COPY --from=build /app/apps/api/dist/ apps/api/dist/
COPY --from=build /app/apps/api/prisma/ apps/api/prisma/
WORKDIR /app/apps/api
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
