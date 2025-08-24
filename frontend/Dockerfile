# Build React app
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve with Caddy (auto HTTPS)
FROM caddy:2-alpine
# Copy built React files
COPY --from=build /app/dist /usr/share/caddy
# Copy custom Caddyfile config
COPY Caddyfile /etc/caddy/Caddyfile
