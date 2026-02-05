FROM node:20 AS builder

WORKDIR /app

# Instalar dependências necessárias para compilar pacotes nativos
RUN apt-get update && apt-get install -y python3 make g++ libc6 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Remover o package-lock para evitar conflito de arquitetura e instalar limpo para Linux
RUN rm -f package-lock.json && npm install

COPY . .

# Argumento para definir a URL da API durante o build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Tentar o build ignorando erros de otimização de CSS se possível
RUN npm run build

FROM node:20-slim AS runner

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
