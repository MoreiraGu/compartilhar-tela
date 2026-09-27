# Imagem enxuta baseada em Alpine
FROM node:20-alpine

WORKDIR /app

# Copia só o manifesto primeiro (cache de layer: só reinstala deps se elas mudarem)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copia o resto do código
COPY . .

# Porta que o server.js usa (ver PORT em server.js)
ENV PORT=3000
EXPOSE 3000

# Usuário não-root por segurança
USER node

CMD ["node", "server.js"]
