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
  console.log(`Fetching WhatsApp groups for instance ${instanceName} from production backend...`);
  try {
    const res = await axios.get(`${backendUrl}/instances/groups/${instanceName}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.data.success) {
      console.log(`Successfully fetched ${res.data.data.length} groups.`);
      console.log(JSON.stringify(res.data.data.slice(0, 10), null, 2));
      
      const unGroup = res.data.data.find(g => g.subject && g.subject.toLowerCase() === 'un');
      console.log("UN Group search result:", unGroup);
    } else {
      console.log("Failed to fetch groups:", res.data);
    }
  } catch (err) {
    console.error("Error:", err.response?.status, err.response?.data || err.message);
  }
}

run();
