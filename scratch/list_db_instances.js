const { Client } = require('pg');

async function listDbInstances() {
  const dbUrl = "postgresql://postgres:pUqSpxfQyJdPRjYgGExrEGBDqKjBqFwN@junction.proxy.rlwy.net:21182/railway";
  const client = new Client({
    connectionString: dbUrl,
    ssl: false // al ser red interna/directa proxy, si da error SSL, probar false o rejectUnauthorized
  });

  try {
    await client.connect();
    console.log("Conectado a la base de datos de Railway.");
    
    const res = await client.query("SELECT id, instance_name, status, phone FROM instances");
    console.log("\n--- INSTANCIAS EN BASE DE DATOS DE ZAZA ---");
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error("Error al consultar base de datos:", err.message);
  } finally {
    await client.end();
  }
}

listDbInstances();
