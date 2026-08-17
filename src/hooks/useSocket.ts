import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useCallStore } from '@/store/useCallStore';
import { toast } from 'sonner';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;
let currentSocketUserId: string | null = null;

export const getSocket = (): Socket | null => socket;

function createSocket(token: string): Socket {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentSocketUserId = null;
  }

  const newSocket = io(SOCKET_URL, {
    auth: { token },
    // Prioritize WebSocket for instant, non-polling connection on Vercel/Render
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket = newSocket;
  return newSocket;
}

export const useSocket = () => {
  const { user, token } = useAuthStore();

  const addMessageRef = useRef(useChatStore.getState().addMessage);
  const setTypingRef = useRef(useChatStore.getState().setTyping);

  useEffect(() => {
    const unsub = useChatStore.subscribe((state) => {
      addMessageRef.current = state.addMessage;
      setTypingRef.current = state.setTyping;
    });
    return unsub;
  }, []);

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

    if (socket && socket.connected && currentSocketUserId === user._id) {
      return;
    }

    const s = createSocket(token);
    currentSocketUserId = user._id;

    s.on('connect', () => {
      console.log('[Socket] Connected | user:', user._id, '| socketId:', s.id, '| transport:', s.io.engine.transport.name);
    });

    s.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    s.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected | reason:', reason);
    });

    s.on('reconnect', (attempt) => {
      console.log('[Socket] Reconnected after', attempt, 'attempt(s) | socketId:', s.id);
    });

    // ── Messaging ─────────────────────────────────────────────────────────────
    s.on('message:receive', (message: any) => {
      addMessageRef.current(message);
      toast.info(`New message from ${message.senderId?.name || 'Friend'}`);

      // If user is currently chatting with this sender, emit message:seen
      const activePartner = useChatStore.getState().activeChatPartner;
      const senderIdStr = typeof message.senderId === 'object' ? message.senderId._id : message.senderId;
      if (activePartner && String(activePartner._id) === String(senderIdStr) && !String(message._id).startsWith('temp-')) {
        s.emit('message:seen', { messageId: message._id, senderId: senderIdStr });
      }
    });

    s.on('message:seen', ({ messageId, seenByUserId }: any) => {
      if (messageId && seenByUserId) {
        useChatStore.getState().markMessageAsSeen(messageId, seenByUserId);
      }
    });

    s.on('message:all-seen', ({ seenByUserId }: any) => {
      if (seenByUserId && user?._id) {
        useChatStore.getState().markAllAsSeenFromSender(user._id, seenByUserId);
      }
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

    // ── Calling ───────────────────────────────────────────────────────────────
    s.on('call:incoming', (data: any) => {
      console.log('[Socket] *** call:incoming ***', JSON.stringify(data));

      const currentStatus = useCallStore.getState().callStatus;
      if (currentStatus !== 'idle') {
        console.log('[Socket] Already in a call — ignoring. Status:', currentStatus);
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

      const callType = data?.callType === 'video' ? 'video' : 'voice';
      console.log('[Socket] Incoming call from:', caller.name, '| ID:', caller._id, '| Type:', callType);
      useCallStore.getState().receiveCall(caller, callType);
      toast.info(callType === 'video' ? `📹 Incoming Video Call from ${caller.name}` : `📞 Incoming Voice Call from ${caller.name}`);
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

    return () => {
      // Only disconnect if user logs out or switches
      if (!useAuthStore.getState().user) {
        s.removeAllListeners();
        s.disconnect();
        socket = null;
        currentSocketUserId = null;
      }
    };
  }, [user?._id, token]);

  return { socket };
};
