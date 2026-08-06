const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:sYtLwUfLphIqomcWcRCEoHixXWlSopcr@junction.proxy.rlwy.net:46247/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const clientsCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'crm_clients'
    `);
    console.log("crm_clients columns:", clientsCols.rows);
    
    const contactsCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'crm_contacts'
    `);
    console.log("crm_contacts columns:", contactsCols.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
