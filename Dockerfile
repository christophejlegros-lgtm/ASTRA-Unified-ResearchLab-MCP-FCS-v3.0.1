# ASTRA MCP Server — Production Container
# © 2026 Christophe Jean Legros — Geneva

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY configs/ ./configs/

# Default to Streamable HTTP transport
EXPOSE 9003
ENV ASTRA_HTTP_PORT=9003
ENV ASTRA_HTTP_HOST=0.0.0.0
ENV ASTRA_LOG_LEVEL=info

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:9003/health || exit 1

CMD ["node", "dist/http-server.js"]
