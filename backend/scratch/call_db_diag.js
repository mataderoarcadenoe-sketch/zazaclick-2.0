const axios = require('axios');

async function run() {
  console.log("Calling production db-diag endpoint...");
  try {
    const res = await axios.get("https://zaza-click-20-production.up.railway.app/api/instances/db-diag");
    console.log("Database Instances in Production:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
