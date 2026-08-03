import pool from './config/database';
import { EvolutionService } from './services/evolution.service';
import redis from './config/redis';

async function run() {
  try {
    const instancesRes = await pool.query('SELECT instance_name, status, api_key FROM instances');
    console.log('--- INSTANCES IN DB ---');
    console.log(instancesRes.rows);

    for (const inst of instancesRes.rows) {
      if (inst.status === 'connected' || inst.instance_name === 'NuevaPrueba01') {
        console.log(`\n--- INSTANCE: ${inst.instance_name} ---`);
        
        // 1. Fetch chats from Evolution API
        const chatsRes = await EvolutionService.getChats(inst.instance_name);
        console.log(`GetChats success: ${chatsRes.success}`);
        if (chatsRes.success) {
          const chats = chatsRes.data || [];
          console.log(`Found ${chats.length} chats.`);
          
          // Let's inspect the first few chats
          chats.slice(0, 5).forEach((c: any) => {
            console.log(`- Chat: ${c.remoteJid || c.id}, name: ${c.name}, jidAlt: ${c.jidAlt}, unreadCount: ${c.unreadCount || c.unreadMessages}`);
          });

          // 2. Fetch messages for the first active chat
          const activeChat = chats.find((c: any) => c.remoteJid && c.remoteJid.includes('51900892668'));
          const chatToQuery = activeChat || chats[0];
          
          if (chatToQuery) {
            const jid = chatToQuery.remoteJid || chatToQuery.id;
            console.log(`\nQuerying messages for JID: ${jid}`);
            const messagesRes = await EvolutionService.getChatMessages(inst.instance_name, jid);
            console.log(`GetChatMessages success: ${messagesRes.success}`);
            if (messagesRes.success) {
              const msgs = messagesRes.data?.messages?.records || messagesRes.data?.records || messagesRes.data || [];
              console.log(`Found ${msgs.length} messages.`);
              msgs.slice(0, 5).forEach((m: any) => {
                console.log(`- Msg: id: ${m.key?.id || m.id}, fromMe: ${m.key?.fromMe}, remoteJid: ${m.key?.remoteJid}, messageType: ${m.messageType}`);
                console.log(`  Content keys:`, m.message ? Object.keys(m.message) : 'none');
              });
            } else {
              console.log('Error querying messages:', messagesRes.error);
            }
          }
        } else {
          console.log('Error querying chats:', chatsRes.error);
        }
      }
    }
  } catch (err) {
    console.error('Error during diagnostic run:', err);
  } finally {
    await pool.end();
    await redis.quit();
  }
}

run();
