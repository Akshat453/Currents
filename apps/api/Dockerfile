FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace=@currents/api --workspace=@currents/shared --include-workspace-root

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
USER node
EXPOSE 4000
CMD ["node", "apps/api/src/server.js"]
