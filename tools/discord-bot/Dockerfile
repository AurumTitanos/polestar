# The bug bot: Node's own WebSocket and fetch, no npm dependencies.
FROM node:24-alpine
WORKDIR /app
COPY bot.js notify.js ./
COPY lib ./lib
USER node
CMD ["node", "bot.js"]
