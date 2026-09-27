const { Pool } = require('./node_modules/pg');
require('./node_modules/dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

async function run() {
  try {
    const p = await pool.query("SELECT id, name, slug, master_key, is_active FROM partners");
    console.log("Partners:", p.rows);
    const u = await pool.query("SELECT id, email, partner_id, role FROM users LIMIT 10");
    console.log("Users:", u.rows);
    const inst = await pool.query("SELECT id, user_id, instance_name, status, engine_type FROM instances LIMIT 10");
    console.log("Instances:", inst.rows);
  } catch(e) {
    console.error("DB Error:", e);
  } finally {
    await pool.end();
  }
}
run();
