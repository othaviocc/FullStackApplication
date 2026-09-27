# ---------------------------------------------------------------------------
# Etapa 1 - build
# O Node compila o projeto React/Vite e gera a pasta dist/ com HTML, CSS e JS
# estaticos. Esta etapa existe apenas durante o build e nao vai para a imagem
# final.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Copiar so os manifestos primeiro aproveita o cache do Docker: enquanto as
# dependencias nao mudarem, o npm ci nao roda de novo a cada alteracao de codigo.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Etapa 2 - producao
# Somente o nginx com os arquivos estaticos. O Node nao existe aqui, o que
# deixa a imagem final pequena e reduz a superficie de ataque.
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS producao

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
