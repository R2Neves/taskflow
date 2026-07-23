FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM dependencies AS builder
ARG INTERNAL_API_URL=http://api:3001
ENV INTERNAL_API_URL=${INTERNAL_API_URL}

COPY apps/web apps/web
COPY packages/shared packages/shared
RUN npm run build -w @taskflow/shared \
    && npm run build -w @taskflow/web

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV INTERNAL_API_URL=http://api:3001
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@taskflow/web", "--", "-H", "0.0.0.0"]
