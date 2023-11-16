const { Client } = require('pg');

const dbClient = new Client({
  user: process.env.AUTH_USER,
  host: process.env.AUTH_HOST,
  database: process.env.AUTH_DATABASE,
  password: process.env.AUTH_PGPASSWORD,
  port: parseInt(process.env.AUTH_PORT, 10),
});

module.exports = dbClient;
