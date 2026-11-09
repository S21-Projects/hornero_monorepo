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
FROM nginx:1.31-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
# The CSP snippet is a template: the official image renders /etc/nginx/templates/* with envsubst
# at container start, into the directory below (only the defined env vars are substituted, so
# nginx's own $variables are untouched).
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/snippets
RUN mkdir -p /etc/nginx/snippets
COPY security-headers.conf.template /etc/nginx/templates/security-headers.conf.template
COPY --chmod=755 docker-entrypoint.d/10-csp-mode.envsh /docker-entrypoint.d/10-csp-mode.envsh

# CSP_API_ORIGIN comes from the same value the bundle was built with.
ARG VITE_BFF_URL=http://localhost:3001
ENV VITE_BFF_URL=$VITE_BFF_URL
# report-only (default) | enforce — overridable at runtime without a rebuild.
ENV CSP_MODE=report-only
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
