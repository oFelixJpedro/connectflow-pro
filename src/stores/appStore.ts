import { create } from 'zustand';
import type { User, Company, Conversation, Message, ConversationFilters, InboxColumn } from '@/types';

// Carregar filtros salvos do localStorage
function loadSavedFilters(): ConversationFilters {
  try {
    const saved = localStorage.getItem('conversationFilters');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Erro ao carregar filtros salvos:', e);
  }
  return {
    status: 'all',
    inboxColumn: 'minhas',
  };
}

// Carregar coluna ativa do localStorage
function loadSavedInboxColumn(): InboxColumn {
  try {
    const saved = localStorage.getItem('inboxActiveColumn');
    if (saved && ['minhas', 'fila', 'todas'].includes(saved)) {
      return saved as InboxColumn;
    }
  } catch (e) {
    console.error('Erro ao carregar coluna salva:', e);
  }
  return 'minhas';
}

// Carregar conexão selecionada do localStorage
function loadSavedConnectionId(): string | null {
  try {
    return localStorage.getItem('selectedConnectionId');
  } catch (e) {
    console.error('Erro ao carregar conexão salva:', e);
  }
  return null;
}

interface AppState {
  // Auth state
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  
  // Inbox state
  selectedConnectionId: string | null;
  currentAccessLevel: 'full' | 'assigned_only' | null;
  inboxColumn: InboxColumn;
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: Message[];
  conversationFilters: ConversationFilters;
  
  // UI state
  sidebarCollapsed: boolean;
  contactPanelOpen: boolean;
  
  // Actions - Auth
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  login: (user: User, company: Company) => void;
  logout: () => void;
  
  // Actions - Inbox
  setSelectedConnectionId: (id: string | null) => void;
  setCurrentAccessLevel: (level: 'full' | 'assigned_only' | null) => void;
  setInboxColumn: (column: InboxColumn) => void;
  setConversations: (conversations: Conversation[]) => void;
  selectConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  setConversationFilters: (filters: Partial<ConversationFilters>) => void;
  resetFilters: () => void;
  
  // Actions - UI
  toggleSidebar: () => void;
  toggleContactPanel: () => void;
  openContactPanel: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  company: null,
  isAuthenticated: false,
  selectedConnectionId: loadSavedConnectionId(),
  currentAccessLevel: null,
  inboxColumn: loadSavedInboxColumn(),
  conversations: [],
  selectedConversation: null,
  messages: [],
  conversationFilters: loadSavedFilters(),
  sidebarCollapsed: false,
  contactPanelOpen: true,
  
  // Auth actions
  setUser: (user) => set({ user }),
  setCompany: (company) => set({ company }),
  login: (user, company) => set({ user, company, isAuthenticated: true }),
  logout: () => set({ 
    user: null, 
    company: null, 
    isAuthenticated: false, 
    conversations: [], 
    selectedConversation: null, 
    messages: [],
    selectedConnectionId: null,
  }),
  
  // Inbox actions
  setSelectedConnectionId: (id) => {
    if (id) {
      localStorage.setItem('selectedConnectionId', id);
    } else {
      localStorage.removeItem('selectedConnectionId');
    }
    // Limpar filtro de departamento e agente ao trocar conexão
    const currentFilters = get().conversationFilters;
    const newFilters = { ...currentFilters, departmentId: undefined, filterByAgentId: undefined };
    localStorage.setItem('conversationFilters', JSON.stringify(newFilters));
    set({ selectedConnectionId: id, currentAccessLevel: null, conversationFilters: newFilters, selectedConversation: null });
  },
  setCurrentAccessLevel: (level) => set({ currentAccessLevel: level }),
  setInboxColumn: (column) => {
    localStorage.setItem('inboxActiveColumn', column);
    set({ inboxColumn: column, selectedConversation: null });
  },
  setConversations: (conversations) => set({ conversations }),
  selectConversation: (conversation) => set({ selectedConversation: conversation }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateConversation: (id, updates) => set((state) => ({
    conversations: state.conversations.map((c) => 
      c.id === id ? { ...c, ...updates } : c
    ),
    selectedConversation: state.selectedConversation?.id === id 
      ? { ...state.selectedConversation, ...updates }
      : state.selectedConversation,
  })),
  setConversationFilters: (filters) => {
    const newFilters = { ...get().conversationFilters, ...filters };
    localStorage.setItem('conversationFilters', JSON.stringify(newFilters));
    set({ conversationFilters: newFilters });
  },
  resetFilters: () => {
    const defaultFilters: ConversationFilters = {
      status: 'all',
      inboxColumn: 'minhas',
    };
    localStorage.removeItem('conversationFilters');
    set({ conversationFilters: defaultFilters, inboxColumn: 'minhas' });
  },
  
  // UI actions
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleContactPanel: () => set((state) => ({ contactPanelOpen: !state.contactPanelOpen })),
  openContactPanel: () => set({ contactPanelOpen: true }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
