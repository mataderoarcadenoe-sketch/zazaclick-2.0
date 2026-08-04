const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'Dashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add crmContactMap state
content = content.replace(
  'const [crmContact, setCrmContact] = useState<any | null>(null);',
  'const [crmContact, setCrmContact] = useState<any | null>(null);\n  const [crmContactMap, setCrmContactMap] = useState<Record<string, string>>({});'
);

// 2. Add fetchCrmContactMap function
const crmCategoriesIndex = content.indexOf('const fetchCrmCategories = useCallback(async () => {');
if (crmCategoriesIndex > -1) {
  const fetchMapStr = 
  // Fetch CRM Contact Map for chats UI
  const fetchCrmContactMap = useCallback(async () => {
    try {
      const res = await api.get('/crm/contacts/map');
      if (res.data?.success) {
        setCrmContactMap(res.data.data || {});
      }
    } catch (err: any) {
      console.error('Error fetching CRM contact map:', err.message);
    }
  }, []);

  ;
  content = content.substring(0, crmCategoriesIndex) + fetchMapStr + content.substring(crmCategoriesIndex);
}

// 3. Update useEffect
content = content.replace(
  /useEffect\(\(\) => \{\s*fetchCrmCategories\(\);\s*\}, \[fetchCrmCategories\]\);/g,
  \useEffect(() => {
    fetchCrmCategories();
    fetchCrmContactMap();
  }, [fetchCrmCategories, fetchCrmContactMap]);\
);

// 4. Update save CRM contact
content = content.replace(
  /setCrmClient\(res\.data\.client\);\s*setCrmContact\(res\.data\.contact\);\s*setCrmIsEditing\(false\);\s*showNotification\('Contacto guardado exitosamente.', 'success'\);/g,
  \setCrmClient(res.data.client);
          setCrmContact(res.data.contact);
          setCrmIsEditing(false);
          fetchCrmContactMap();
          showNotification('Contacto guardado exitosamente.', 'success');\
);

content = content.replace(
  /setCrmClient\(res\.data\.client\);\s*setCrmContact\(res\.data\.contact\);\s*setCrmIsEditing\(false\);\s*setCrmMergeModal\(prev => \(\{ \.\.\.prev, isOpen: false \}\)\);\s*showNotification\('Cliente y contacto vinculados correctamente.', 'success'\);/g,
  \setCrmClient(res.data.client);
        setCrmContact(res.data.contact);
        setCrmIsEditing(false);
        setCrmMergeModal(prev => ({ ...prev, isOpen: false }));
        fetchCrmContactMap();
        showNotification('Cliente y contacto vinculados correctamente.', 'success');\
);

// 5. Update contact list name display
content = content.replace(
  /const isUnread = unreadCount > 0;\s*const contactName = chat\.pushName \|\| chat\.remoteJid\.split\('@'\)\[0\];/g,
  \const isUnread = unreadCount > 0;
                              const cleanRemoteJid = chat.remoteJid.split('@')[0];
                              const contactName = crmContactMap[cleanRemoteJid] || chat.pushName || cleanRemoteJid;\
);

// 6. Update contact header display
content = content.replace(
  /\{selectedChat\.pushName \|\| selectedChat\.remoteJid\.split\('@'\)\[0\]\}/g,
  \{crmContactMap[selectedChat.remoteJid.split('@')[0]] || selectedChat.pushName || selectedChat.remoteJid.split('@')[0]}\
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Modifications complete');
