const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:pUqSpxfQyJdPRjYgGExrEGBDqKjBqFwN@junction.proxy.rlwy.net:21182/railway',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("=== CHECKING INSTANCES ===");
    const instances = await pool.query("SELECT id, instance_name, apikey, status, user_id FROM instances");
    console.log("Instances:", instances.rows);

    console.log("\n=== CHECKING LID CONTACTS ===");
    const lidContacts = await pool.query(`
      SELECT c.id as contact_id, c.phone_number, cl.name as client_name, c.pipeline_stage, c.user_id 
      FROM crm_contacts c
      JOIN crm_clients cl ON c.client_id = cl.id
      WHERE LENGTH(c.phone_number) >= 14 OR (c.phone_number LIKE '1%' AND LENGTH(c.phone_number) >= 13)
      LIMIT 20
    `);
    console.log("LID Contacts found:", lidContacts.rows.length);
    lidContacts.rows.forEach((c, idx) => {
      console.log(`[${idx}] phone: ${c.phone_number} | name: ${c.client_name} | stage: ${c.pipeline_stage} | user_id: ${c.user_id}`);
    });
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

run();
