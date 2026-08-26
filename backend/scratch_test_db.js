const { Client } = require('pg');

async function testDb() {
  const dbUrl = "postgresql://postgres:sYtLwUfLphIqomcWcRCEoHixXWlSopcr@junction.proxy.rlwy.net:46247/railway";
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Conectado a la base de datos de Railway (puerto 46247)!");
    const res = await client.query("SELECT id, instance_name, status, apikey FROM instances LIMIT 5");
    console.log("Instancias:", res.rows);
  } catch (err) {
    console.error("Error conectando a la base de datos:", err);
  } finally {
    await client.end();
  }
}

testDb();
