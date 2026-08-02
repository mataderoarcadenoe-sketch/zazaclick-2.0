const axios = require('axios');

async function test() {
  const apiKey = 'B6D711FCDE4D4FD5936544120E713976';
  const instance = 'Syscom.click';
  
  try {
    // 1. Get chats
    const chatsRes = await axios.post(`https://api.wps.sycompro.com/chat/findChats/${instance}`, {}, {
      headers: { 'apikey': apiKey }
    });
    console.log("Chats count:", chatsRes.data.length);
    
    // Find a chat with unread messages
    const unreadChat = chatsRes.data.find(c => c.unreadCount > 0);
    if (!unreadChat) {
      console.log("No chats with unread messages found. Just testing mark as read payload.");
      // grab the first one to test
      const chat = chatsRes.data[0];
      const msgsRes = await axios.post(`https://api.wps.sycompro.com/chat/findMessages/${instance}`, {
        where: { key: { remoteJid: chat.remoteJid } },
        limit: 1
      }, {
        headers: { 'apikey': apiKey }
      });
      const messages = msgsRes.data;
      if (messages.length > 0) {
        console.log("Trying to mark as read:", messages[0].key.id);
        const payload = {
          readMessages: [{
            remoteJid: chat.remoteJid,
            fromMe: false,
            id: messages[0].key.id
          }]
        };
        const markRes = await axios.post(`https://api.wps.sycompro.com/chat/markMessageAsRead/${instance}`, payload, {
          headers: { 'apikey': apiKey }
        });
        console.log("Mark as read response:", markRes.data);
      }
      return;
    }
    
    console.log("Found unread chat:", unreadChat.remoteJid, "Count:", unreadChat.unreadCount);
    
    const msgsRes = await axios.post(`https://api.wps.sycompro.com/chat/findMessages/${instance}`, {
      where: { key: { remoteJid: unreadChat.remoteJid } },
      limit: 10
    }, {
      headers: { 'apikey': apiKey }
    });
    
    const messages = msgsRes.data;
    const unreadMessages = messages.filter(m => !m.key.fromMe).slice(0, 5); 
    
    if (unreadMessages.length > 0) {
      console.log("Trying to mark as read:", unreadMessages[0].key.id);
      
      const payload = {
        readMessages: [
          {
            remoteJid: unreadChat.remoteJid,
            fromMe: false,
            id: unreadMessages[0].key.id
          }
        ]
      };
      
      const markRes = await axios.post(`https://api.wps.sycompro.com/chat/markMessageAsRead/${instance}`, payload, {
        headers: { 'apikey': apiKey }
      });
      
      console.log("Mark as read response:", markRes.data);
    }
    
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

test();
