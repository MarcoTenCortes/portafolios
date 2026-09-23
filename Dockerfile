# syntax=docker/dockerfile:1.7
# Imagen del portafolio: sitio estático servido por nginx sin privilegios.
#
# Etapa 1 (build): corre en la plataforma del builder (--platform=$BUILDPLATFORM), así que al construir
# para linux/arm64 desde un runner amd64 Node no se emula; solo la etapa final es de la plataforma destino.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Etapa 2 (runtime): nginx sin root, escucha en 8080 (en el servidor se publica como 8951).
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
