const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:sYtLwUfLphIqomcWcRCEoHixXWlSopcr@junction.proxy.rlwy.net:46247/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkDb() {
  try {
    const resInsts = await pool.query('SELECT * FROM instances');
    console.log("Database Instances:", resInsts.rows);

    const resUsers = await pool.query('SELECT id, email, role FROM users');
    console.log("Database Users:", resUsers.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkDb();
