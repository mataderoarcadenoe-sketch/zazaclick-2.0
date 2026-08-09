const axios = require('axios');

async function run() {
  console.log("Calling production chat-diag endpoint...");
  try {
    const res = await axios.get("https://zaza-click-20-production.up.railway.app/api/instances/chat-diag/Zaza2");
    console.log("Production Raw Chats Sample:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
