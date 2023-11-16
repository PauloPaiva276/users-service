const { Client } = require('pg')

const dbClient = new Client({
  user: process.env.PSEUDONYMS_USER,
  host: process.env.PSEUDONYMS_HOST,
  database: process.env.PSEUDONYMS_DATABASE,
  password: process.env.PSEUDONYMS_PGPASSWORD,
  port: parseInt(process.env.PSEUDONYMS_PORT, 10),
});

module.exports = dbClient;
