FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/trading-engine ./cmd/trading-engine

FROM scratch
USER 65532:65532
COPY --from=build /out/trading-engine /trading-engine
EXPOSE 8081
ENTRYPOINT ["/trading-engine"]
