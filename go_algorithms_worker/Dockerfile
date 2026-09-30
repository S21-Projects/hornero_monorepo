# ---- Build stage ----
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Copy module descriptor first for layer caching.
COPY go.mod ./
RUN go mod download

COPY main.go ./
COPY internal ./internal
# CGO_ENABLED=0: a fully static binary that runs unmodified on the alpine
# runtime image below, no libc mismatch.
RUN CGO_ENABLED=0 go build -o /app/algorithms .

# ---- Runtime stage ----
FROM alpine:3.20 AS runtime

WORKDIR /app

# wget backs the compose healthcheck against GET /healthz; there is no
# actuator-equivalent dependency to add for that in a stdlib-only Go binary.
RUN apk add --no-cache wget

COPY --from=builder /app/algorithms ./algorithms
COPY data ./data

EXPOSE 8090

# POBLACION_CSV is optional (AD-2): when unset every candidate resolves to
# NEUTRAL, which the worker logs at startup. It cannot be a plain ENTRYPOINT
# arg because exec-form ENTRYPOINT does not expand environment variables, so
# this wraps the fixed args in a shell that only adds --poblacion when the
# path is actually set and mounted.
ENTRYPOINT ["/bin/sh", "-c", "exec ./algorithms serve --addr :8090 --data data/renacom.csv ${POBLACION_CSV:+--poblacion \"$POBLACION_CSV\"}"]
