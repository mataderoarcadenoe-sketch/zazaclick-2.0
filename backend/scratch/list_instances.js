const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "4296088A962E3B1C5D4180A84D581F78";

async function run() {
  console.log("Fetching all instances from Evolution API...");
  try {
    const res = await axios.get(`${evUrl}/instance/fetchInstances`, {
      headers: { apikey: evKey }
    });
    console.log("Instances Response:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("FetchInstances Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
