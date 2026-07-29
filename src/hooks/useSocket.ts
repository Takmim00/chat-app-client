import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useCallStore } from '@/store/useCallStore';
import { useGroupStore } from '@/store/useGroupStore';
import { toast } from 'sonner';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => socket;

export const useSocket = () => {
  const { user, token } = useAuthStore();
  const { addMessage, updateMessage, setTyping } = useChatStore();
  const { receiveCall, endCall, callStatus } = useCallStore();

  useEffect(() => {
    if (!user || !token) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return;
    }

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Socket] Real-time connected as user:', user._id);
    });

    // 1-to-1 Direct Message Receive
    socket.on('message:receive', (message) => {
      console.log('[Socket Direct Message Received]:', message);
      addMessage(message);
      toast.info(`New message from ${message.senderId?.name || 'Friend'}`);
    });

    // Group Message Receive
    socket.on('group:message-receive', ({ groupId, message }) => {
      console.log('[Socket Group Message Received]:', groupId, message);
      addMessage(message);
      toast.info(`New group message`);
    });

    // Typing Indicators
    socket.on('typing:start', ({ senderId }) => {
      setTyping(senderId, true);
    });

    socket.on('typing:stop', ({ senderId }) => {
      setTyping(senderId, false);
    });

    socket.on('group:typing', ({ userId, isTyping }) => {
      setTyping(userId, isTyping);
    });

    // 1-to-1 Calling Events
    socket.on('call:incoming', ({ callerInfo }) => {
      if (callStatus === 'idle') {
        receiveCall(callerInfo);
      }
    });

    socket.on('call:ended', () => {
      endCall();
      toast.info('Call ended by partner.');
    });

    socket.on('call:rejected', () => {
      endCall();
      toast.warning('Call was rejected.');
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, [user, token, addMessage, setTyping, receiveCall, endCall, callStatus]);

  return { socket };
};
