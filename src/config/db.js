const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'auth_db', // ⚠️ база должна существовать
    password: '1234',
    port: 5432,
});

module.exports = pool;