SERVICES=("api-gateway" "identity-service" "tenant-service" "notification-service" "audit-service")
sed -i -E 's/context: \.\/services\/(.*)/context: \.\n      dockerfile: \.\/services\/\1\/Dockerfile/' docker-compose.yml
for s in "${SERVICES[@]}"; do
    DS="services/$s/Dockerfile"
    sed -i "s|COPY package\*.json ./|COPY services/$s/package*.json ./|" "$DS"
    sed -i "s|COPY tsconfig.json ./|COPY services/$s/tsconfig.json ./|" "$DS"
    sed -i "s|COPY src/ ./src/|COPY services/$s/src/ ./src/\nCOPY proto/ /proto/|" "$DS"
    sed -i "s|COPY --from=builder /app/dist ./dist|COPY --from=builder /app/dist ./dist\nCOPY --from=builder /proto /proto|" "$DS"
done
