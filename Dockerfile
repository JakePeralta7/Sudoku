# -- Stage 1: deps (build native modules) -------------------------------------
FROM node:22-alpine AS deps

WORKDIR /build

# Required to compile better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/package.json
RUN corepack enable && pnpm install --frozen-lockfile --filter backend

COPY backend/ ./backend/
RUN pnpm --dir backend exec tsc -p tsconfig.json

# -- Stage 2: runtime ----------------------------------------------------------
FROM node:22-alpine

# tini for proper PID 1 signal handling
RUN apk add --no-cache tini

WORKDIR /app

# Copy frontend source
COPY frontend/ ./frontend/

# Copy compiled backend output
COPY --from=deps /build/backend/dist ./backend/dist

# Copy pnpm virtual store used by backend/node_modules symlinks
COPY --from=deps /build/node_modules ./node_modules

# Copy production node_modules from deps stage
COPY --from=deps /build/backend/node_modules ./backend/node_modules

# Create data directory for SQLite volume mount
RUN mkdir -p /data

ENV DB_PATH=/data/sudoku.db

# Non-root user
RUN addgroup -S sudoku && adduser -S sudoku -G sudoku \
    && chown -R sudoku:sudoku /app /data

USER sudoku

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/dist/server.js"]

