# ---- Build stage ----
FROM node:26-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:26-alpine AS runtime

WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main"]
