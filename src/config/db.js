const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'auth_db',     // ← укажи свою базу
    password: process.env.DB_PASSWORD || 'твой_пароль',
    port: process.env.DB_PORT || 5432,
});

pool.on('connect', () => {
    console.log('✅ PostgreSQL подключён успешно');
});

module.exports = pool;