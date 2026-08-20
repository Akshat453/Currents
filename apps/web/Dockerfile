FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace=@currents/web --workspace=@currents/shared --include-workspace-root
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build -w @currents/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
