import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

const nodeEnv = process.env.NODE_ENV;

if (!process.env.DB_HOST) {
  const envFile = nodeEnv === 'development' ? '.env.development' : '.env';
  const envPath = path.resolve(process.cwd(), envFile);
  dotenv.config({ path: envPath });
  dotenv.config({ path: envPath });
}

console.log(`--- DB CONFIG ---`);
console.log(`Ambiente: ${nodeEnv}`);
console.log(`Variables de entorno cargadas: ${JSON.stringify({
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME,
})}`);
console.log(`-----------------`);


export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'budgetgenius',
  schema: 'bg_public',
  logging: true,
  // Usamos strings de ruta. TypeORM las resolverá relativo a la raíz del proyecto.
  entities: ['src/**/*.entity.{ts,js}'],
  migrations: ['src/migrations/*.{ts,js}'],
  synchronize: false,
});