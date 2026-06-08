# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

# NEXT_PUBLIC_* vars must be available at build time
ARG NEXT_PUBLIC_BFF_URL=http://localhost:3001
ENV NEXT_PUBLIC_BFF_URL=$NEXT_PUBLIC_BFF_URL
ENV NODE_ENV=production

RUN npm run build

# ---- Runtime stage ----
# Re-use the builder as runtime to avoid copying node_modules again.
# For a leaner image enable output:'standalone' in next.config.ts and
# switch to the standalone pattern documented in Next.js docs.
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
