import { create } from 'zustand';
import { Message, User, ActiveTab } from '@/types';

interface ChatState {
  activeTab: ActiveTab;
  activeChatPartner: User | null;
  messages: Message[];
  replyingTo: Message | null;
  typingUsers: Set<string>; // userIds
  unreadCounts: Record<string, number>; // friendId/groupId -> count
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
  clearUnread: (id: string) => void;
  setSearchQuery: (query: string) => void;
  toggleSearchOpen: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeTab: 'chats',
  activeChatPartner: null,
  messages: [],
  replyingTo: null,
  typingUsers: new Set(),
  unreadCounts: {},
  searchQuery: '',
  isSearchOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setActiveChatPartner: (user) =>
    set((state) => {
      const nextUnread = { ...state.unreadCounts };
      if (user) {
        delete nextUnread[user._id];
      }
      return { activeChatPartner: user, messages: [], replyingTo: null, unreadCounts: nextUnread };
    }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => {
      const senderIdStr = typeof message.senderId === 'object' ? message.senderId._id : message.senderId;

      // Check if message belongs to current active direct chat partner
      const isForActiveChat =
        state.activeChatPartner &&
        (senderIdStr === state.activeChatPartner._id || message.chatId === state.activeChatPartner._id);

      // If message is for another chat, increment unread count for that conversation without appending to active chat
      if (!isForActiveChat && senderIdStr) {
        const conversationId = message.groupId || senderIdStr;
        const currentCount = state.unreadCounts[conversationId] || 0;
        return {
          unreadCounts: {
            ...state.unreadCounts,
            [conversationId]: currentCount + 1,
          },
        };
      }

      // 1. Prevent duplicate messages by ID
      if (state.messages.some((m) => m._id === message._id)) {
        return state;
      }

      // 2. Replace temp optimistic message if real saved message arrives
      const tempIndex = state.messages.findIndex((m) => {
        const mSenderIdStr = typeof m.senderId === 'object' ? m.senderId._id : m.senderId;
        return m._id.startsWith('temp-') && mSenderIdStr === senderIdStr && m.content === message.content;
      });

      if (tempIndex !== -1) {
        const updated = [...state.messages];
        updated[tempIndex] = message;
        return { messages: updated };
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

  clearUnread: (id) =>
    set((state) => {
      const next = { ...state.unreadCounts };
      delete next[id];
      return { unreadCounts: next };
    }),

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
