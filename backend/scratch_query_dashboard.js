const { Client } = require('pg');

async function check() {
  const dbUrl = "postgresql://postgres:pUqSpxfQyJdPRjYgGExrEGBDqKjBqFwN@junction.proxy.rlwy.net:21182/railway";
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("CONNECTED TO PRODUCTION DB");

    const usersRes = await client.query("SELECT id, email, name, role, is_active FROM users");
    console.log("\n--- USERS ---");
    console.log(usersRes.rows);

    const companiesRes = await client.query("SELECT id, name, ruc, subdomain, is_active FROM companies");
    console.log("\n--- COMPANIES ---");
    console.log(companiesRes.rows);
  } catch (err) {
    console.error("DB Query error:", err.message);
  } finally {
    await client.end();
    process.exit(0);
  }
}

check();
