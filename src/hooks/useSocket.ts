import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useCallStore } from '@/store/useCallStore';
import { toast } from 'sonner';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// Single global socket instance — persists across component re-renders and effect cycles
let socket: Socket | null = null;
let currentSocketUserId: string | null = null;

export const getSocket = (): Socket | null => socket;

// Helper to create a fresh socket connection and join server rooms
function createSocket(token: string): Socket {
  // Ensure any existing socket is fully disconnected first
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentSocketUserId = null;
  }

  const newSocket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  socket = newSocket;
  return newSocket;
}

export const useSocket = () => {
  const { user, token } = useAuthStore();

  // useRef for store actions so they never trigger re-renders or effect re-runs
  const addMessageRef = useRef(useChatStore.getState().addMessage);
  const setTypingRef = useRef(useChatStore.getState().setTyping);

  // Keep refs up to date without triggering re-renders
  useEffect(() => {
    const unsubChat = useChatStore.subscribe((state) => {
      addMessageRef.current = state.addMessage;
      setTypingRef.current = state.setTyping;
    });
    return unsubChat;
  }, []);

  // Effect ONLY depends on user._id and token — Zustand function refs never change
  useEffect(() => {
    if (!user || !token) {
      // Disconnect if logged out
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
        currentSocketUserId = null;
      }
      return;
    }

    // If already connected as this user, do NOT recreate socket
    if (socket && socket.connected && currentSocketUserId === user._id) {
      return;
    }

    // Create (or recreate) socket connection for this user
    const s = createSocket(token);
    currentSocketUserId = user._id;

    s.on('connect', () => {
      console.log('[Socket] Connected | user:', user._id, '| socketId:', s.id);
    });

    s.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    s.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected | reason:', reason);
    });

    // ─── Direct Message ───────────────────────────────────────────
    s.on('message:receive', (message: any) => {
      addMessageRef.current(message);
      toast.info(`New message from ${message.senderId?.name || 'Friend'}`);
    });

    // ─── Group Message ────────────────────────────────────────────
    s.on('group:message-receive', ({ message }: any) => {
      addMessageRef.current(message);
      toast.info('New group message');
    });

    // ─── Friend Events ────────────────────────────────────────────
    s.on('friend:accepted', () => {
      toast.success('Friend request accepted!');
      window.dispatchEvent(new Event('friends:updated'));
    });

    s.on('friend:request-received', () => {
      toast.info('You received a new friend request!');
      window.dispatchEvent(new Event('friend-requests:updated'));
    });

    // ─── Typing Indicators ────────────────────────────────────────
    s.on('typing:start', ({ senderId }: any) => setTypingRef.current(senderId, true));
    s.on('typing:stop', ({ senderId }: any) => setTypingRef.current(senderId, false));
    s.on('group:typing', ({ userId, isTyping }: any) => setTypingRef.current(userId, isTyping));

    // ─── Calling Events — always read FRESH state from Zustand store ───
    s.on('call:incoming', (data: any) => {
      console.log('[Socket] *** call:incoming ***', JSON.stringify(data));

      const currentStatus = useCallStore.getState().callStatus;
      if (currentStatus !== 'idle') {
        console.log('[Socket] Already in a call — ignoring incoming. Status:', currentStatus);
        return;
      }

      const rawCaller = data?.callerInfo || {};
      const caller = {
        _id: rawCaller._id || data?.callerId || 'unknown',
        email: rawCaller.email || '',
        name: rawCaller.name || rawCaller.username || 'Incoming Call',
        username: rawCaller.username || rawCaller.name || '',
        profilePic: rawCaller.profilePic || '',
        friendId: rawCaller.friendId || '',
      };
      console.log('[Socket] Incoming call from:', caller.name, 'ID:', caller._id);
      useCallStore.getState().receiveCall(caller);
      toast.info(`Incoming Voice Call from ${caller.name}`);
    });

    s.on('call:accepted', (data: any) => {
      console.log('[Socket] call:accepted', data);
      const myId = useAuthStore.getState().user?._id;
      const targetId = data?.targetCallerId || data?.callerId;
      if (targetId && myId && String(targetId) !== String(myId)) return;
      useCallStore.getState().acceptCall();
    });

    s.on('call:ended', (data: any) => {
      console.log('[Socket] call:ended', data);
      const myId = useAuthStore.getState().user?._id;
      const targetId = data?.targetPartnerId || data?.partnerId || data?.receiverId;
      if (targetId && myId && String(targetId) !== String(myId)) return;
      const status = useCallStore.getState().callStatus;
      if (status === 'idle') return;
      useCallStore.getState().endCall();
      toast.info('Call ended by partner.');
    });

    s.on('call:rejected', (data: any) => {
      console.log('[Socket] call:rejected', data);
      const myId = useAuthStore.getState().user?._id;
      const targetId = data?.targetCallerId || data?.callerId;
      if (targetId && myId && String(targetId) !== String(myId)) return;
      useCallStore.getState().endCall();
      toast.warning('Call was rejected.');
    });

    // Cleanup: remove ALL listeners only (don't disconnect on dependency changes)
    return () => {
      s.removeAllListeners();
    };

  }, [user?._id, token]); // Only user._id and token — no Zustand functions in deps

  return { socket };
};
