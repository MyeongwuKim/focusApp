FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --no-package-lock --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

EXPOSE 8080
ENV NODE_ENV=production

CMD ["node", "--import", "tsx", "src/server.ts"]
