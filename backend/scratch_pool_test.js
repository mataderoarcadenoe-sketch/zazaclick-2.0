process.env.DATABASE_URL = 'postgresql://postgres:sYtLwUfLphIqomcWcRCEoHixXWlSopcr@junction.proxy.rlwy.net:46247/railway';
const pool = require('./dist/config/database').default;

async function run() {
  try {
    const clientsCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'crm_clients'
    `);
    console.log("crm_clients columns:", clientsCols.rows.map(r => r.column_name));
    
    const clientRow = await pool.query("SELECT * FROM crm_clients LIMIT 1");
    console.log("First client row:", clientRow.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
