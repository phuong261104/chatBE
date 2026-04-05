FROM node:22-alpine

WORKDIR /app

# Required for some native modules
RUN apk add --no-cache make gcc g++ python3

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start"]
