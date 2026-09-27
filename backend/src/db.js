const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'erp_db',
  user: process.env.DB_USER || 'erp_user',
  password: process.env.DB_PASS,
});

module.exports = pool;
