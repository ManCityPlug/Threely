FROM node:20-slim
WORKDIR /app
COPY apps/discord-bot/package.json ./
RUN npm install --production
COPY apps/discord-bot/index.js ./
CMD ["node", "index.js"]
