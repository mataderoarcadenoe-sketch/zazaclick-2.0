const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:sYtLwUfLphIqomcWcRCEoHixXWlSopcr@junction.proxy.rlwy.net:46247/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Forcing instance status in database to 'connected'...");
    const res = await pool.query(
      "UPDATE instances SET status = 'connected' WHERE instance_name = 'NuevaPrueba01'"
    );
    console.log("Update result:", res.rowCount, "rows updated.");

    const resInsts = await pool.query('SELECT instance_name, status FROM instances');
    console.log("Current DB Instances:", resInsts.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
