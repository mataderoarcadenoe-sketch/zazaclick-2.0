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
  const realPhone = "51931175234";
  const lid = "199652041302076";

  console.log("--- TESTING WIKY ALEXIS REQUESTS ON PRODUCTION ---");

  // 1. GET /crm/contacts/51931175234
  console.log(`\n1. GET /crm/contacts/${realPhone}`);
  try {
    const res = await axios.get(`${backendUrl}/crm/contacts/${realPhone}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Status:", res.status);
    console.log("Data:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }

  // 2. GET /crm/contacts/199652041302076 (LID)
  console.log(`\n2. GET /crm/contacts/${lid}`);
  try {
    const res = await axios.get(`${backendUrl}/crm/contacts/${lid}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Status:", res.status);
    console.log("Data:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }

  // 3. POST /instances/chats/Zaza2/messages for 51931175234@s.whatsapp.net / 199652041302076@lid
  console.log(`\n3. POST /instances/chats/${instanceName}/messages (remoteJid: 51931175234@s.whatsapp.net, originalJid: 199652041302076@lid)`);
  try {
    const res = await axios.post(`${backendUrl}/instances/chats/${instanceName}/messages`, {
      remoteJid: `${realPhone}@s.whatsapp.net`,
      originalJid: `${lid}@lid`
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Status:", res.status);
    console.log("Success:", res.data.success);
    console.log("Messages count:", res.data.data?.length);
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }

  // 4. POST /instances/chats/Zaza2/messages for 199652041302076@lid / 199652041302076@lid
  console.log(`\n4. POST /instances/chats/${instanceName}/messages (remoteJid: 199652041302076@lid, originalJid: 199652041302076@lid)`);
  try {
    const res = await axios.post(`${backendUrl}/instances/chats/${instanceName}/messages`, {
      remoteJid: `${lid}@lid`,
      originalJid: `${lid}@lid`
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Status:", res.status);
    console.log("Success:", res.data.success);
    console.log("Messages count:", res.data.data?.length);
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
