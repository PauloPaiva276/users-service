const { Client } = require('pg');

const dbClient = new Client({
  user: process.env.USERS_USER,
  host: process.env.USERS_HOST,
  database: process.env.USERS_DATABASE,
  password: process.env.USERS_PGPASSWORD,
  port: parseInt(process.env.USERS_PORT, 10),
});

module.exports = dbClient;
