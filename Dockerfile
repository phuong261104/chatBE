FROM node:22-alpine

WORKDIR /app

# Required for some native modules
RUN apk add --no-cache make gcc g++ python3

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN mkdir -p uploads logs && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["npm", "run", "demo"]
