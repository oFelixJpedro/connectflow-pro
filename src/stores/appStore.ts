import { create } from 'zustand';
import type { User, Company, Conversation, Message, ConversationFilters } from '@/types';

interface AppState {
  // Auth state
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  
  // Conversations state
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
  
  // Actions - Conversations
  setConversations: (conversations: Conversation[]) => void;
  selectConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  setConversationFilters: (filters: Partial<ConversationFilters>) => void;
  
  // Actions - UI
  toggleSidebar: () => void;
  toggleContactPanel: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  company: null,
  isAuthenticated: false,
  conversations: [],
  selectedConversation: null,
  messages: [],
  conversationFilters: {
    status: 'all',
    assignedUserId: 'all',
  },
  sidebarCollapsed: false,
  contactPanelOpen: true,
  
  // Auth actions
  setUser: (user) => set({ user }),
  setCompany: (company) => set({ company }),
  login: (user, company) => set({ user, company, isAuthenticated: true }),
  logout: () => set({ user: null, company: null, isAuthenticated: false, conversations: [], selectedConversation: null, messages: [] }),
  
  // Conversation actions
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
  setConversationFilters: (filters) => set((state) => ({
    conversationFilters: { ...state.conversationFilters, ...filters },
  })),
  
  // UI actions
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleContactPanel: () => set((state) => ({ contactPanelOpen: !state.contactPanelOpen })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
