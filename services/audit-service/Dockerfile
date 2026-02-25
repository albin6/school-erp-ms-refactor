FROM node:22-alpine AS builder
WORKDIR /app
COPY services/audit-service/package*.json ./
RUN npm ci
COPY services/audit-service/tsconfig.json ./
COPY services/audit-service/src/ ./src/
COPY proto/ /proto/
RUN npm run build
FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY services/audit-service/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /proto /proto
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:3000/health/live || exit 1
CMD ["node", "dist/index.js"]
