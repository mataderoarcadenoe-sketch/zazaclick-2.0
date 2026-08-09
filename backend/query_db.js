const { Client } = require('pg');

async function queryDb() {
  const dbUrl = "postgresql://postgres:pUqSpxfQyJdPRjYgGExrEGBDqKjBqFwN@junction.proxy.rlwy.net:21182/railway";
  
  console.log("Connecting to PG...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully!");

    // Check if there are contacts with invalid phone numbers
    console.log("\n--- CRM CLIENTS WITH EMPTY OR WEIRD PHONES ---");
    const weirdClients = await client.query("SELECT id, name, doc_number, phone_number FROM crm_contacts JOIN crm_clients ON crm_contacts.client_id = crm_clients.id WHERE phone_number IS NULL OR phone_number = '' OR phone_number LIKE '%undefined%' OR phone_number LIKE '%g.us%'");
    console.log(weirdClients.rows);

    // Get Wiky Alexis contact details
    console.log("\n--- WIKY ALEXIS CONTACT DETAILS ---");
    const wiky = await client.query("SELECT * FROM crm_contacts JOIN crm_clients ON crm_contacts.client_id = crm_clients.id WHERE phone_number LIKE '%51931175234%'");
    console.log(wiky.rows);

  } catch (err) {
    console.error("Database connection error:", err.message);
  } finally {
    await client.end();
  }
}

queryDb();
