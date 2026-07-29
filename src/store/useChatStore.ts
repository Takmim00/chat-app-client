import { create } from 'zustand';
import { Message, User, ActiveTab } from '@/types';

interface ChatState {
  activeTab: ActiveTab;
  activeChatPartner: User | null;
  messages: Message[];
  replyingTo: Message | null;
  typingUsers: Set<string>; // userIds
  searchQuery: string;
  isSearchOpen: boolean;

  setActiveTab: (tab: ActiveTab) => void;
  setActiveChatPartner: (user: User | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  deleteMessage: (messageId: string, deleteForEveryone: boolean, userId: string) => void;
  setReplyingTo: (message: Message | null) => void;
  setTyping: (userId: string, isTyping: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleSearchOpen: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeTab: 'chats',
  activeChatPartner: null,
  messages: [],
  replyingTo: null,
  typingUsers: new Set(),
  searchQuery: '',
  isSearchOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setActiveChatPartner: (user) => set({ activeChatPartner: user, messages: [], replyingTo: null }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => {
      if (state.messages.some((m) => m._id === message._id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    }),

  updateMessage: (updatedMsg) =>
    set((state) => ({
      messages: state.messages.map((m) => (m._id === updatedMsg._id ? updatedMsg : m)),
    })),

  deleteMessage: (messageId, deleteForEveryone, userId) =>
    set((state) => ({
      messages: state.messages
        .map((m) => {
          if (m._id !== messageId) return m;
          if (deleteForEveryone) {
            return { ...m, isDeletedForEveryone: true, content: 'This message was deleted' };
          }
          return { ...m, deletedFor: [...m.deletedFor, userId] };
        })
        .filter((m) => !m.deletedFor.includes(userId)),
    })),

  setReplyingTo: (message) => set({ replyingTo: message }),

  setTyping: (userId, isTyping) =>
    set((state) => {
      const next = new Set(state.typingUsers);
      if (isTyping) next.add(userId);
      else next.delete(userId);
      return { typingUsers: next };
    }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleSearchOpen: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
}));
