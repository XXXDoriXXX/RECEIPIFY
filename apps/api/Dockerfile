# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y python3 make g++ openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY libs/infra/prisma/prisma/schema.prisma ./libs/infra/prisma/prisma/schema.prisma
RUN npx prisma generate --schema=libs/infra/prisma/prisma/schema.prisma

COPY . .

# Run Nx build for the api
RUN npx nx build api --configuration=production

# Stage 2: Production
FROM node:20-slim

WORKDIR /app

# Install production dependencies
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# Copy built assets and generated prisma client
COPY --from=builder /app/dist/apps/api ./dist/apps/api
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Environment variables
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/apps/api/main.js"]
