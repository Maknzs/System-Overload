FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback + proxy to API
RUN printf "server {\n  listen 80;\n  location / { try_files $uri /index.html; }\n  location /api/ { proxy_pass http://api:8080/; }\n}\n" > /etc/nginx/conf.d/default.conf
EXPOSE 80
