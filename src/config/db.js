const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'auth_db',
        password: process.env.DB_PASSWORD || '1234',
        port: Number(process.env.DB_PORT) || 5432,
      };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
    console.log('✅ PostgreSQL подключён успешно');
});

pool.on('error', (err) => {
    console.error('❌ Ошибка PostgreSQL:', err.message);
});

module.exports = pool;