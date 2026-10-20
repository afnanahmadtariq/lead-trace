FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

COPY apps/api apps/api
COPY packages/db packages/db
ENV DATABASE_URL=postgresql://prisma:prisma@localhost:5432/prisma?schema=public
RUN npm run generate --workspace=@lead-trace/db
RUN npm run build --workspace=@lead-trace/db
RUN npm run build --workspace=@lead-trace/api

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/db/generated packages/db/generated
COPY --from=build /app/packages/db/dist packages/db/dist
COPY packages/db/prisma packages/db/prisma
COPY packages/db/prisma.config.ts packages/db/prisma.config.ts
COPY apps/api/docker-entrypoint.sh apps/api/docker-entrypoint.sh
RUN chmod +x apps/api/docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["apps/api/docker-entrypoint.sh"]
CMD ["serve"]
