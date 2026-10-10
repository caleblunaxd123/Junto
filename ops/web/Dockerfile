FROM node:22-bookworm-slim
WORKDIR /web
COPY ops/web/server.cjs /web/server.cjs
COPY apps/mobile/dist-beta/ /web/public/
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 WEB_ROOT=/web/public
USER node
EXPOSE 8080
CMD ["node", "/web/server.cjs"]
