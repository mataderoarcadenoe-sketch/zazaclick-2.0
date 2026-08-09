const axios = require('axios');

const evUrl = "https://evolution-api-production-8b953.up.railway.app";
const evKey = "4296088A962E3B1C5D4180A84D581F78";
const instanceName = "Zaza2";

async function run() {
  console.log(`Querying findChats for "${instanceName}"...`);
  try {
    const res = await axios.post(`${evUrl}/chat/findChats/${instanceName}`, {}, {
      headers: { apikey: evKey, 'Content-Type': 'application/json' }
    });
    console.log(`Success! Found ${res.data?.length} chats.`);
    if (res.data?.length > 0) {
      console.log("First 3 chats:", res.data.slice(0, 3).map(c => ({ id: c.id, name: c.name })));
    }
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
