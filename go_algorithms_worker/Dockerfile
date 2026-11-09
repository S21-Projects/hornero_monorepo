# ---- Build stage ----
FROM golang:1.27-alpine AS builder

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
# The only data in the image: simplified census radio polygons for POST /v1/radio
# (regenerate with `make mapa-radios`). No scoring CSVs ship here.
COPY data/radios-2022.ndjson.gz ./data/radios-2022.ndjson.gz

EXPOSE 8090

# No scoring data ships in the image: the MS computes each candidate's live deficit from the
# database, and a candidate without one resolves to NEUTRAL. The CSVs under data/ only feed the
# offline `metrics` / `assign` subcommands. A failing --radios load only disables POST /v1/radio.
ENTRYPOINT ["./algorithms", "serve", "--addr", ":8090", "--radios", "data/radios-2022.ndjson.gz"]
