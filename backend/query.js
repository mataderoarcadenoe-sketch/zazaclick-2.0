const { Pool } = require('pg');
require('dotenv').config();

// Extraemos la URL y la parseamos nosotros mismos o usamos pg-connection-string
const { parse } = require('pg-connection-string');
const config = parse(process.env.DATABASE_URL);

const pool = new Pool({
  user: config.user,
  password: config.password,
  host: config.host,
  port: config.port,
  database: config.database,
  ssl: false
});

async function run() {
  try {
    const res = await pool.query("SELECT phone_number, tags FROM crm_contacts WHERE tags::text != 'null' LIMIT 20;");
    console.log("Contacts with tags:");
    console.log(res.rows);
  } catch (err) {
    console.error("DB Query Error:", err);
  } finally {
    pool.end();
  }
}

run();
