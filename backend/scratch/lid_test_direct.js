const axios = require('axios');

async function testResolution() {
  const evUrl = "https://evolution-api-production-8b953.up.railway.app";
  const evKey = "lwJAq9M4NwHmtM5bqk1k";
  
  // Let's first query the connected instances on this Evolution API
  let instances = [];
  try {
    const instRes = await axios.get(`${evUrl}/instance/fetchInstances`, {
      headers: { apikey: evKey }
    });
    instances = instRes.data;
    console.log("Connected instances:", instances.map(i => ({ name: i.instanceName, status: i.connectionStatus })));
  } catch (err) {
    console.error("Error fetching instances:", err.response?.data || err.message);
    return;
  }

  const activeInstance = instances.find(i => i.connectionStatus === 'CONNECTED')?.instanceName || instances[0]?.instanceName;
  if (!activeInstance) {
    console.log("No instances available to test.");
    return;
  }
  console.log("Using active instance for testing:", activeInstance);

  const lids = [
    "161074661863530@lid",
    "161074661863530@s.whatsapp.net",
    "171202396065822@lid",
    "171202396065822@s.whatsapp.net",
    "100038948741313@lid"
  ];

  for (const lid of lids) {
    console.log(`\n=================== TESTING LID: ${lid} ===================`);
    
    // Method 1: POST /chat/fetchProfile/[instance]
    try {
      const res = await axios.post(`${evUrl}/chat/fetchProfile/${activeInstance}`, {
        number: lid
      }, {
        headers: { apikey: evKey }
      });
      console.log("fetchProfile Success:");
      console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.warn("fetchProfile Error:", err.response?.status, err.response?.data || err.message);
    }

    // Method 2: GET /contact/profile/[instance]
    try {
      const res = await axios.get(`${evUrl}/contact/profile/${activeInstance}`, {
        params: { number: lid },
        headers: { apikey: evKey }
      });
      console.log("contact/profile Success:");
      console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.warn("contact/profile Error:", err.response?.status, err.response?.data || err.message);
    }
  }
}

testResolution();
