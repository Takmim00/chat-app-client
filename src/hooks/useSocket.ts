import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useCallStore } from '@/store/useCallStore';
import { toast } from 'sonner';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => socket;

export const useSocket = () => {
  const { user, token } = useAuthStore();
  const { addMessage, setTyping } = useChatStore();
  const { receiveCall, acceptCall, endCall } = useCallStore();

  useEffect(() => {
    if (!user || !token) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return;
    }

    // Reuse existing active socket if connected with same token
    if (!socket || !socket.connected) {
      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => {
        console.log('[Socket Persistent] Real-time connected as user:', user._id);
      });
    }

    // Direct Message Receive
    const handleDirectMessage = (message: any) => {
      console.log('[Socket Direct Message Received]:', message);
      addMessage(message);
      toast.info(`New message from ${message.senderId?.name || 'Friend'}`);
    };

    // Group Message Receive
    const handleGroupMessage = ({ message }: any) => {
      console.log('[Socket Group Message Received]:', message);
      addMessage(message);
      toast.info(`New group message`);
    };

    // Friend Real-Time Events
    const handleFriendAccepted = () => {
      toast.success('Friend request accepted! Friend added to your chat list.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('friends:updated'));
      }
    };

    const handleFriendRequestReceived = () => {
      toast.info('You received a new friend request!');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('friend-requests:updated'));
      }
    };

    // Typing Indicators
    const handleTypingStart = ({ senderId }: any) => setTyping(senderId, true);
    const handleTypingStop = ({ senderId }: any) => setTyping(senderId, false);
    const handleGroupTyping = ({ userId, isTyping }: any) => setTyping(userId, isTyping);

    // 1-to-1 Calling Events
    const handleIncomingCall = (data: any) => {
      console.log('[Socket] Incoming call received:', data);
      const caller = data?.callerInfo || { _id: data?.callerId, name: 'Incoming Call' };
      receiveCall(caller);
    };

    const handleCallAccepted = () => {
      console.log('[Socket] Call was accepted by recipient');
      acceptCall();
    };

    const handleCallEnded = () => {
      endCall();
      toast.info('Call ended by partner.');
    };

    const handleCallRejected = () => {
      endCall();
      toast.warning('Call was rejected.');
    };

    socket.on('message:receive', handleDirectMessage);
    socket.on('group:message-receive', handleGroupMessage);
    socket.on('friend:accepted', handleFriendAccepted);
    socket.on('friend:request-received', handleFriendRequestReceived);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('group:typing', handleGroupTyping);
    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:rejected', handleCallRejected);

    return () => {
      if (socket) {
        socket.off('message:receive', handleDirectMessage);
        socket.off('group:message-receive', handleGroupMessage);
        socket.off('friend:accepted', handleFriendAccepted);
        socket.off('friend:request-received', handleFriendRequestReceived);
        socket.off('typing:start', handleTypingStart);
        socket.off('typing:stop', handleTypingStop);
        socket.off('group:typing', handleGroupTyping);
        socket.off('call:incoming', handleIncomingCall);
        socket.off('call:accepted', handleCallAccepted);
        socket.off('call:ended', handleCallEnded);
        socket.off('call:rejected', handleCallRejected);
      }
    };
  }, [user?._id, token, addMessage, setTyping, receiveCall, endCall]);

  return { socket };
};
