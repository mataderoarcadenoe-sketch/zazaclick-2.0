import { create } from 'zustand';

export interface Instance {
  id: string;
  instance_name: string;
  phone: string | null;
  status: 'connected' | 'disconnected';
  api_key: string;
  created_at: string;
}

interface CrmStore {
  // Instances
  instances: Instance[];
  selectedInstanceForChats: string;
  activeQrInstance: string | null;
  qrBase64: string | null;
  qrLoading: boolean;
  
  // Chats
  chats: any[];
  selectedChat: any | null;
  messages: any[];
  presences: Record<string, string>;
  
  // Media Caching States
  loadedMedia: Record<string, string>;
  mediaLoadingStates: Record<string, boolean>;
  
  // CRM Client & Contacts
  crmClients: any[];
  crmClientContacts: any[];

  // Actions
  setInstances: (instances: Instance[] | ((prev: Instance[]) => Instance[])) => void;
  setSelectedInstanceForChats: (instance: string) => void;
  setActiveQrInstance: (instance: string | null | ((prev: string | null) => string | null)) => void;
  setQrBase64: (qr: string | null) => void;
  setQrLoading: (loading: boolean) => void;
  
  setChats: (chats: any[] | ((prev: any[]) => any[])) => void;
  setSelectedChat: (chat: any | null) => void;
  setMessages: (messages: any[] | ((prev: any[]) => any[])) => void;
  setPresences: (presences: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  
  setLoadedMedia: (media: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setMediaLoadingStates: (states: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  
  setCrmClients: (clients: any[] | ((prev: any[]) => any[])) => void;
  setCrmClientContacts: (contacts: any[] | ((prev: any[]) => any[])) => void;

  // Optimistic UI updates helper
  addOptimisticMessage: (text: string, remoteJid: string) => void;
}

export const useCrmStore = create<CrmStore>((set) => ({
  instances: [],
  selectedInstanceForChats: '',
  activeQrInstance: null,
  qrBase64: null,
  qrLoading: false,
  
  chats: [],
  selectedChat: null,
  messages: [],
  presences: {},
  
  loadedMedia: {},
  mediaLoadingStates: {},
  
  crmClients: [],
  crmClientContacts: [],

  setInstances: (val) => set((state) => ({
    instances: typeof val === 'function' ? val(state.instances) : val
  })),
  
  setSelectedInstanceForChats: (val) => set({ selectedInstanceForChats: val }),
  
  setActiveQrInstance: (val) => set((state) => ({
    activeQrInstance: typeof val === 'function' ? val(state.activeQrInstance) : val
  })),
  
  setQrBase64: (val) => set({ qrBase64: val }),
  setQrLoading: (val) => set({ qrLoading: val }),
  
  setChats: (val) => set((state) => ({
    chats: typeof val === 'function' ? val(state.chats) : val
  })),
  
  setSelectedChat: (val) => set({ selectedChat: val }),
  
  setMessages: (val) => set((state) => ({
    messages: typeof val === 'function' ? val(state.messages) : val
  })),
  
  setPresences: (val) => set((state) => ({
    presences: typeof val === 'function' ? val(state.presences) : val
  })),
  
  setLoadedMedia: (val) => set((state) => ({
    loadedMedia: typeof val === 'function' ? val(state.loadedMedia) : val
  })),
  
  setMediaLoadingStates: (val) => set((state) => ({
    mediaLoadingStates: typeof val === 'function' ? val(state.mediaLoadingStates) : val
  })),
  
  setCrmClients: (val) => set((state) => ({
    crmClients: typeof val === 'function' ? val(state.crmClients) : val
  })),
  
  setCrmClientContacts: (val) => set((state) => ({
    crmClientContacts: typeof val === 'function' ? val(state.crmClientContacts) : val
  })),

  // Optimistic UI updates for sending messages
  addOptimisticMessage: (text, remoteJid) => set((state) => {
    const tempMsgId = `temp_${Date.now()}`;
    const tempMsgObj = {
      key: {
        remoteJid,
        fromMe: true,
        id: tempMsgId
      },
      message: {
        conversation: text
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: 'PENDING'
    };

    // 1. Inject message into the current messages state
    const updatedMessages = [tempMsgObj, ...state.messages];

    // 2. Push the matching chat to the top in sidebar chats list and update its lastMessage
    const updatedChats = state.chats.map((chat) => {
      if (chat.remoteJid === remoteJid) {
        return {
          ...chat,
          lastMessage: tempMsgObj
        };
      }
      return chat;
    });

    // Sort updatedChats to move the active one to the top
    const chatIndex = updatedChats.findIndex((c) => c.remoteJid === remoteJid);
    if (chatIndex > 0) {
      const activeChat = updatedChats[chatIndex];
      updatedChats.splice(chatIndex, 1);
      updatedChats.unshift(activeChat);
    }

    return {
      messages: updatedMessages,
      chats: updatedChats
    };
  })
}));
