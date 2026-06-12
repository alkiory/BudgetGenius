import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Misma lógica de carga que data-source.ts
if (!process.env.DB_HOST) {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFile = nodeEnv === 'development' ? '.env.development' : '.env';
  dotenv.config({ path: path.resolve(process.cwd(), envFile) });
}

async function setup() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'budgetgenius',
  });

  try {
    await client.connect();
    await client.query('CREATE SCHEMA IF NOT EXISTS bg_public;');
    console.log('✅ Schema bg_public verificado/creado');
    await client.end();
  } catch (err) {
    // @ts-ignore
    console.error('❌ Error en premigration:', err.message);
    process.exit(1);
  }
}

setup();