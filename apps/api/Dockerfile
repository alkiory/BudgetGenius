FROM node:20

WORKDIR /app

# 1. Instalar pnpm globalmente
RUN npm install -g pnpm

# 2. Copiar archivos de definición del Workspace (CRUCIAL)
# Necesitamos estos 3 para que pnpm entienda el monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 3. Copiar los package.json de las aplicaciones (sin el código aún)
# Esto permite cachear las dependencias si el código cambia pero no los paquetes
COPY apps/api/package.json ./apps/api/
COPY apps/webClient/package.json ./apps/webClient/

# 4. Instalar dependencias del workspace
RUN pnpm install --frozen-lockfile

# 5. Copiar el resto del código fuente
COPY . .

# 6. Las variables de entorno NO se copian a la imagen.
# El archivo apps/api/.env.production se horneaba aquí (`COPY ... .env`),
# lo que dejaba JWT_SECRET, DB_PASS y las claves de Firebase legibles en
# cualquier capa de la imagen. Ahora el entorno llega en runtime
# (docker-compose.prod.yml → env_file / environment). `.dockerignore`
# excluye los .env para que ni siquiera `COPY . .` los arrastre.

# 7. Build usando Turborepo
# Usamos el comando de pnpm pero nos aseguramos de estar en la carpeta correcta
WORKDIR /app/apps/api
RUN pnpm run build

# 8. Verificación y Ejecución
EXPOSE 5000

# El comando de arranque:
# 1. Ejecuta las migraciones (usando el DataSource compilado si es posible, 
#    o el comando pnpm que ya probamos).
# 2. Inicia la app.
# CMD pnpm migration:run && node dist/src/main.js
# El CMD ahora correrá el "pre" (crear esquema) y luego el "run" (migraciones)
CMD pnpm run premigration:run && pnpm run migration:run && node dist/src/main.js