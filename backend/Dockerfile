FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Prefer reproducible installs; fall back to npm install if lock is out of sync
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
