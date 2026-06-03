FROM node:22-alpine

LABEL org.opencontainers.image.source="https://github.com/phuong261104/chatBE"
LABEL org.opencontainers.image.description="ChatBE backend API"
LABEL org.opencontainers.image.licenses="ISC"

WORKDIR /app

# Required for some native modules
RUN apk add --no-cache make gcc g++ python3

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build && npm prune --omit=dev

RUN mkdir -p uploads logs && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health/live', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npm", "run", "start:prod"]
