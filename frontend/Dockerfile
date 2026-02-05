FROM node:20 AS builder

WORKDIR /app

# Instalar dependências necessárias para compilar pacotes nativos
RUN apt-get update && apt-get install -y python3 make g++ libc6 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Forçar o download dos binários corretos para Linux
RUN npm install --platform=linux --arch=x64

COPY . .

# Argumento para definir a URL da API durante o build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Desabilitar o lightningcss se ele continuar falhando, mas primeiro tentamos com os binários certos
RUN npm run build

FROM node:20-slim AS runner

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]
