# Use Node.js 18 Alpine
FROM node:18-alpine

# Install build dependencies and security utilities
RUN apk add --no-cache python3 make g++ git dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S gitdata -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps to handle conflicts
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Copy source code
COPY . .

# Copy additional required files
COPY src/db/postgresql-schema.sql ./src/db/
COPY src/db/schema-d08-realtime-packets.sql ./src/db/

# Create data directories
RUN mkdir -p /app/data/headers /app/data/storage /app/logs && \
    chown -R gitdata:nodejs /app

# Switch to non-root user
USER gitdata

# Expose port
EXPOSE 8788

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
  const req = http.request({hostname: 'localhost', port: 8788, path: '/health', timeout: 2000}, (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1); \
  }); \
  req.on('error', () => process.exit(1)); \
  req.on('timeout', () => process.exit(1)); \
  req.end();"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8788

# Start application with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]