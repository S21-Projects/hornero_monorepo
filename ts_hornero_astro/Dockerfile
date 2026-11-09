# ---- Build stage ----
# Astro 7 requires Node >= 22.12 (see package.json "engines").
FROM node:26-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .

# PUBLIC_* vars are inlined into the client bundle at build time — they must be
# the public, browser-reachable URLs. BFF_BASE_URL is server-only and is read at
# runtime instead (see the runtime stage / compose env), so it is NOT set here.
ARG PUBLIC_BFF_URL=http://localhost:3001
ARG PUBLIC_SPA_URL=http://localhost:5173
ENV PUBLIC_BFF_URL=$PUBLIC_BFF_URL
ENV PUBLIC_SPA_URL=$PUBLIC_SPA_URL
ENV NODE_ENV=production

RUN npm run build

# ---- Runtime stage ----
FROM node:26-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
# @astrojs/node standalone reads HOST/PORT — bind to all interfaces for Docker.
ENV HOST=0.0.0.0
ENV PORT=4321

# astro + @astrojs/node are production deps, so --omit=dev is enough at runtime.
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
