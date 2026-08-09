const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = "zaza_saas_jwt_secret_2026_super_key";
const backendUrl = "https://zaza-click-20-production.up.railway.app/api";

const token = jwt.sign({
  id: "user_1785654247524_367",
  tenantId: "user_1785654247524_367",
  role: "admin"
}, JWT_SECRET, { expiresIn: '1h' });

async function run() {
  const instanceName = "Zaza2";
  console.log(`Fetching chats for instance ${instanceName} from production backend...`);
  try {
    const res = await axios.get(`${backendUrl}/instances/chats/${instanceName}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.data.success) {
      console.log(`Successfully fetched ${res.data.data.length} chats.`);
      const wikyChats = res.data.data.filter(c => 
        (c.name && c.name.toLowerCase().includes('wiky')) || 
        (c.pushName && c.pushName.toLowerCase().includes('wiky')) ||
        (c.remoteJid && c.remoteJid.includes('519')) // Peruvian number prefix
      );
      
      console.log(`Found ${wikyChats.length} potential matches for Wiky or Peruvian numbers:`);
      wikyChats.slice(0, 10).forEach((c, idx) => {
        console.log(`[${idx}] JID: ${c.remoteJid} | Name: ${c.name} | pushName: ${c.pushName} | originalJid: ${c.originalJid}`);
      });

      // Let's also check if there is a specific chat with "HERRERA SUCSE"
      const herreraChats = res.data.data.filter(c => 
        (c.name && c.name.toLowerCase().includes('herrera')) || 
        (c.pushName && c.pushName.toLowerCase().includes('herrera'))
      );
      console.log(`Found ${herreraChats.length} matches for Herrera:`);
      herreraChats.forEach((c, idx) => {
        console.log(`[${idx}] JID: ${c.remoteJid} | Name: ${c.name} | pushName: ${c.pushName} | originalJid: ${c.originalJid}`);
      });

    } else {
      console.log("Failed to fetch chats:", res.data);
    }
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
