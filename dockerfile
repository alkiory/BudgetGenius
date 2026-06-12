# Dockerfile para Render (en la raíz del proyecto)
FROM node:20

WORKDIR /app

# Copiar archivos necesarios
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/webClient/package.json ./apps/webClient/

# Instalar pnpm y dependencias
RUN npm install -g pnpm
RUN pnpm install

# Copiar todo el código
COPY . .

# Construir el proyecto
RUN pnpm build

# Comando para ejecutar (Render usará este)
CMD ["pnpm", "start"]