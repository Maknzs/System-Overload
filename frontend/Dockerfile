FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# serve the Vite build
COPY --from=build /app/dist /usr/share/nginx/html

# Write a clean server block. Note the $$ to escape $ for the shell during build.
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    \n\
    # Proxy API to the Express container\n\
    location /api/ {\n\
    proxy_pass http://api:8080;\n\
    proxy_set_header Host $$host;\n\
    proxy_set_header X-Real-IP $$remote_addr;\n\
    proxy_set_header X-Forwarded-For $$proxy_add_x_forwarded_for;\n\
    }\n\
    \n\
    # SPA fallback\n\
    location / {\n\
    try_files $$uri $$uri/ /index.html;\n\
    }\n\
    }\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80