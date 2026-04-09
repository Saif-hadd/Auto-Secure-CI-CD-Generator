FROM node:20-alpine AS builder

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./

RUN npm ci --only=production=false && \
    npm cache clean --force

COPY . .

RUN npm run build

RUN find /app/dist -type f -name "*.map" -delete

FROM nginx:1.28-alpine

RUN apk update && \
    apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

RUN rm -rf /usr/share/nginx/html/*

RUN addgroup -S nginxgroup && adduser -S nginxuser -G nginxgroup

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY security-headers.conf /etc/nginx/conf.d/security-headers.conf

RUN chown -R nginxuser:nginxgroup /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginxuser:nginxgroup /var/cache/nginx && \
    chown -R nginxuser:nginxgroup /var/log/nginx && \
    chown -R nginxuser:nginxgroup /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginxuser:nginxgroup /var/run/nginx.pid

RUN chmod -R 750 /etc/nginx/conf.d

USER nginxuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl --fail --silent http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]