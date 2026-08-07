process.env.DATABASE_URL = 'postgresql://postgres:sYtLwUfLphIqomcWcRCEoHixXWlSopcr@junction.proxy.rlwy.net:46247/railway';
process.env.EVOLUTION_API_URL = 'https://evolution-api-production-8b953.up.railway.app';
process.env.EVOLUTION_API_KEY = 'lwJAq9M4NwHmtM5bqk1k';

const { EvolutionService } = require('../dist/services/evolution.service');

async function run() {
  const instanceName = 'NuevaPrueba01';
  console.log("Starting test_backend_chats...");

  try {
    console.log("1. Calling EvolutionService.getChats...");
    const chatsResult = await EvolutionService.getChats(instanceName);
    console.log("getChats success:", chatsResult.success);
    if (!chatsResult.success) {
      console.error("getChats failed:", chatsResult.error);
      return;
    }
    console.log("Raw chats count:", chatsResult.data?.length || 0);

    console.log("2. Calling getUnreadCountsFromApi...");
    const dbUnreadCounts = await EvolutionService.getUnreadCountsFromApi(instanceName);
    console.log("dbUnreadCounts size:", dbUnreadCounts ? dbUnreadCounts.size : 0);

    console.log("3. Calling mergeChats...");
    const cleanChats = await EvolutionService.mergeChats(instanceName, chatsResult.data || [], dbUnreadCounts);
    console.log("mergeChats success. Clean chats count:", cleanChats.length);
    console.log("First clean chat sample:", cleanChats[0]);
  } catch (err) {
    console.error("Test Exception:", err);
  }
}

run();
