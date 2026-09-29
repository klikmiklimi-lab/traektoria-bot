FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY bot/ ./bot/
COPY data/opportunities.json ./data/opportunities.json

EXPOSE 3000

CMD ["node", "bot/index.js"]