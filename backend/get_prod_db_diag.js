const axios = require('axios');
const backendUrl = "https://zaza-click-20-production.up.railway.app/api";

async function run() {
  console.log("Fetching DB diagnostic from production backend...");
  try {
    const res = await axios.get(`${backendUrl}/instances/db-diag`);
    console.log("Status:", res.status);
    console.log("Data:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
