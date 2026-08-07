const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:sYtLwUfLphIqomcWcRCEoHixXWlSopcr@junction.proxy.rlwy.net:46247/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const resInsts = await pool.query('SELECT instance_name, status, api_key FROM instances');
    console.log("Database Instances:", resInsts.rows);
  } catch (err) {
    console.error("Database query failed:", err.message || err);
  } finally {
    await pool.end();
  }
}
run();
