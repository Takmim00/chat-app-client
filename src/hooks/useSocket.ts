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

// Creates a brand new socket, evicting any previous one
function createSocket(token: string): Socket {
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
    reconnectionAttempts: Infinity,   // Keep trying forever
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket = newSocket;
  return newSocket;
}

export const useSocket = () => {
  const { user, token } = useAuthStore();

  // Stable refs for store callbacks — never triggers re-renders or effect cycles
  const addMessageRef = useRef(useChatStore.getState().addMessage);
  const setTypingRef = useRef(useChatStore.getState().setTyping);

  useEffect(() => {
    const unsub = useChatStore.subscribe((state) => {
      addMessageRef.current = state.addMessage;
      setTypingRef.current = state.setTyping;
    });
    return unsub;
  }, []);

  // ── ONLY depends on user._id + token — no Zustand functions ────────────────
  useEffect(() => {
    if (!user || !token) {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
        currentSocketUserId = null;
      }
      return;
    }

    // Already connected as this user — don't recreate
    if (socket && socket.connected && currentSocketUserId === user._id) {
      return;
    }

    const s = createSocket(token);
    currentSocketUserId = user._id;

    // ── Connection lifecycle ──────────────────────────────────────────────────
    s.on('connect', () => {
      console.log('[Socket] Connected | user:', user._id, '| socketId:', s.id);
    });

    s.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    s.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected | reason:', reason);
    });

    s.on('reconnect', (attempt) => {
      console.log('[Socket] Reconnected after', attempt, 'attempts | new socketId:', s.id);
    });

    // ── Messaging ─────────────────────────────────────────────────────────────
    s.on('message:receive', (message: any) => {
      addMessageRef.current(message);
      toast.info(`New message from ${message.senderId?.name || 'Friend'}`);
    });

    s.on('group:message-receive', ({ message }: any) => {
      addMessageRef.current(message);
      toast.info('New group message');
    });

    // ── Friends ───────────────────────────────────────────────────────────────
    s.on('friend:accepted', () => {
      toast.success('Friend request accepted!');
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('friends:updated'));
    });

    s.on('friend:request-received', () => {
      toast.info('You received a new friend request!');
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('friend-requests:updated'));
    });

    // ── Typing ────────────────────────────────────────────────────────────────
    s.on('typing:start', ({ senderId }: any) => setTypingRef.current(senderId, true));
    s.on('typing:stop', ({ senderId }: any) => setTypingRef.current(senderId, false));
    s.on('group:typing', ({ userId, isTyping }: any) => setTypingRef.current(userId, isTyping));

    // ── Call events — always read FRESH state via getState() ──────────────────
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

      console.log('[Socket] Incoming call from:', caller.name, '| ID:', caller._id);
      useCallStore.getState().receiveCall(caller);
      toast.info(`📞 Incoming Voice Call from ${caller.name}`);
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

    // Cleanup: only remove listeners, DO NOT disconnect on dep changes
    return () => {
      s.removeAllListeners();
    };

  }, [user?._id, token]); // ← Only these two — NEVER Zustand functions

  return { socket };
};
