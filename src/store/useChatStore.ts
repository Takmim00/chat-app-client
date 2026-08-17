import { create } from 'zustand';
import { Message, User, ActiveTab } from '@/types';
import { useGroupStore } from './useGroupStore';
import { useAuthStore } from './useAuthStore';

interface ChatState {
  activeTab: ActiveTab;
  activeChatPartner: User | null;
  messages: Message[];
  messagesCache: Record<string, Message[]>; // chatId/groupId -> messages cache
  isMessagesLoading: boolean;
  replyingTo: Message | null;
  typingUsers: Set<string>; // userIds
  unreadCounts: Record<string, number>; // friendId/groupId -> count
  friendRequestCount: number;
  searchQuery: string;
  isSearchOpen: boolean;
  hasMore: boolean;
  loadingMore: boolean;

  setHasMore: (hasMore: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setIsMessagesLoading: (loading: boolean) => void;
  prependMessages: (messages: Message[]) => void;

  markMessageAsSeen: (messageId: string, seenByUserId: string) => void;
  markAllAsSeenFromSender: (senderId: string, viewerId: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setActiveChatPartner: (user: User | null) => void;
  setMessages: (messages: Message[], conversationId?: string) => void;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  markMessageFailed: (messageId: string) => void;
  removeMessage: (messageId: string) => void;
  deleteMessage: (messageId: string, deleteForEveryone: boolean, userId: string) => void;
  setReplyingTo: (message: Message | null) => void;
  setTyping: (userId: string, isTyping: boolean) => void;
  clearUnread: (id: string) => void;
  setFriendRequestCount: (count: number) => void;
  setSearchQuery: (query: string) => void;
  toggleSearchOpen: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeTab: 'chats',
  activeChatPartner: null,
  messages: [],
  messagesCache: {},
  isMessagesLoading: false,
  replyingTo: null,
  typingUsers: new Set(),
  unreadCounts: {},
  friendRequestCount: 0,
  searchQuery: '',
  isSearchOpen: false,
  hasMore: false,
  loadingMore: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setIsMessagesLoading: (isMessagesLoading) => set({ isMessagesLoading }),

  setActiveChatPartner: (user) =>
    set((state) => {
      const nextUnread = { ...state.unreadCounts };
      let cachedMessages: Message[] = [];
      if (user) {
        delete nextUnread[user._id];
        cachedMessages = state.messagesCache[user._id] || [];
      }
      return {
        activeChatPartner: user,
        messages: cachedMessages,
        isMessagesLoading: cachedMessages.length === 0 && Boolean(user),
        replyingTo: null,
        unreadCounts: nextUnread,
      };
    }),

  setMessages: (messages, conversationId) =>
    set((state) => {
      const targetId = conversationId || state.activeChatPartner?._id;
      return {
        messages,
        isMessagesLoading: false,
        messagesCache: targetId
          ? { ...state.messagesCache, [targetId]: messages }
          : state.messagesCache,
      };
    }),

  setHasMore: (hasMore) => set({ hasMore }),
  setLoadingMore: (loading) => set({ loadingMore: loading }),
  prependMessages: (newMessages) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m._id));
      const unique = newMessages.filter((m) => !existingIds.has(m._id));
      return { messages: [...unique, ...state.messages] };
    }),

  markMessageAsSeen: (messageId, seenByUserId) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m._id !== messageId) return m;
        const alreadySeen = m.seenBy?.some((s) => {
          const uId = typeof s.userId === 'object' ? (s.userId as any)._id : s.userId;
          return String(uId) === String(seenByUserId);
        });
        if (alreadySeen) return m;
        return {
          ...m,
          seenBy: [...(m.seenBy || []), { userId: seenByUserId as any, timestamp: new Date().toISOString() }],
        };
      }),
    })),

  markAllAsSeenFromSender: (senderId, viewerId) =>
    set((state) => ({
      messages: state.messages.map((m) => {
        const mSenderId = typeof m.senderId === 'object' ? (m.senderId as any)._id : m.senderId;
        if (String(mSenderId) !== String(senderId)) return m;
        const alreadySeen = m.seenBy?.some((s) => {
          const uId = typeof s.userId === 'object' ? (s.userId as any)._id : s.userId;
          return String(uId) === String(viewerId);
        });
        if (alreadySeen) return m;
        return {
          ...m,
          seenBy: [...(m.seenBy || []), { userId: viewerId as any, timestamp: new Date().toISOString() }],
        };
      }),
    })),

  addMessage: (message) =>
    set((state) => {
      const senderIdStr = typeof message.senderId === 'object' ? message.senderId._id : message.senderId;
      const currentUserId = (useAuthStore.getState() as any).user?._id;
      const isMyMessage = Boolean(currentUserId && String(senderIdStr) === String(currentUserId));

      // Check if message belongs to current active chat (direct partner OR active group)
      const activeGroup = (useGroupStore.getState() as any).activeGroup;
      const isForActiveChat =
        isMyMessage ||
        (state.activeChatPartner &&
          (String(senderIdStr) === String(state.activeChatPartner._id) ||
            (message.chatId && String(message.chatId) === String(state.activeChatPartner._id)))) ||
        (activeGroup && message.groupId && String(message.groupId) === String(activeGroup._id));

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

  markMessageFailed: (messageId) =>
    set((state) => ({
      messages: state.messages.map((m) => (m._id === messageId ? { ...m, isFailed: true } : m)),
    })),

  removeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m._id !== messageId),
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

  setFriendRequestCount: (count) => set({ friendRequestCount: count }),

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
