const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "4296088A962E3B1C5D4180A84D581F78";
const instanceName = "Zaza2";

async function run() {
  console.log(`Inspecting chats for "${instanceName}"...`);
  try {
    const res = await axios.post(`${evUrl}/chat/findChats/${instanceName}`, {}, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    console.log(`Total chats: ${res.data?.length}`);
    if (res.data?.length > 0) {
      console.log("Raw object of first 3 chats:", JSON.stringify(res.data.slice(0, 3), null, 2));
    }
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
