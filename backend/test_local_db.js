const { Client } = require('pg');

async function testLocalDb() {
  const passwords = ['', 'postgres', 'admin', 'root', '123456'];
  
  for (const password of passwords) {
    console.log(`Trying password: "${password}"...`);
    const client = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: password,
      database: 'postgres'
    });
    
    try {
      await client.connect();
      console.log(`SUCCESS! Connected with password: "${password}"`);
      
      const res = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false");
      console.log("Databases:", res.rows.map(r => r.datname));
      await client.end();
      return;
    } catch (err) {
      console.log(`Failed: ${err.message}`);
    }
  }
}

testLocalDb();
