# ---- Build stage ----
# Vite 8 requires Node >= 20.19 || >= 22 — use 22 to match the rest of the stack.
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .

# VITE_* vars are inlined into the bundle at build time. The SPA talks to the BFF
# straight from the browser, so this must be the PUBLIC api origin.
ARG VITE_BFF_URL=http://localhost:3001
ENV VITE_BFF_URL=$VITE_BFF_URL

RUN npm run build

# ---- Runtime stage ----
# Static build served by nginx with SPA history fallback.
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
