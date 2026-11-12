FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies for root, backend and frontend.
COPY package*.json ./
COPY Backend/package*.json Backend/
COPY catalogo-vgv/package*.json catalogo-vgv/
RUN npm ci && npm --prefix Backend ci && npm --prefix catalogo-vgv ci

# Build frontend and copy static output expected by backend.
COPY . .
RUN npm run build
RUN npm --prefix Backend prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/Backend /app/Backend
COPY --from=build /app/public /app/public
COPY --from=build /app/public_html /app/public_html

RUN mkdir -p /app/Backend/logs && chown -R node:node /app/Backend/logs

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "Backend/server.js"]
