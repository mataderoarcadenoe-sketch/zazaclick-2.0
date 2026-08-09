const { Client } = require('pg');

async function testDb() {
  const dbUrl = "postgresql://postgres:pUqSpxfQyJdPRjYgGExrEGBDqKjBqFwN@junction.proxy.rlwy.net:21182/railway";
  const client = new Client({
    connectionString: dbUrl,
    ssl: false
  });

  try {
    await client.connect();
    console.log("Conectado a la base de datos de Railway!");
    const res = await client.query("SELECT id, instance_name, status, phone FROM instances LIMIT 5");
    console.log("Instancias:", res.rows);
  } catch (err) {
    console.error("Error conectando a la base de datos:", err);
  } finally {
    await client.end();
  }
}

testDb();
