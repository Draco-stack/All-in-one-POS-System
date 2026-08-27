# Stage 1: Build Phase
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
# Install ALL dependencies (including devDependencies) so that Vite/esbuild are available for the build step
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy application source
COPY . .

# Build Vite frontend and esbuild backend
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV="production"
ENV PORT=3000

# Copy necessary configuration and dependency manifest
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled backend and frontend assets from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose the production port
EXPOSE 3000

# Start the application using the compiled CommonJS server bundle
CMD ["node", "dist/server.cjs"]
