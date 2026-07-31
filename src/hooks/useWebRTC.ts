import { useEffect } from 'react';
import { getSocket } from './useSocket';
import { useCallStore, callWebRTCRef, CallType } from '@/store/useCallStore';
import { useAuthStore } from '@/store/useAuthStore';
import { User } from '@/types';
import { toast } from 'sonner';

export const useWebRTC = () => {
  const { partner } = useCallStore();
  const { user } = useAuthStore();

  const startCall = (targetPartnerUser?: User, callType: CallType = 'voice') => {
    const s = getSocket();
    const currentPartner = targetPartnerUser ?? partner ?? useCallStore.getState().partner;
    const currentUser = user ?? useAuthStore.getState().user;

    if (!s || !s.connected) {
      toast.error('Connection issue — please wait and try again.');
      console.warn('[ZEGOCloud] Socket not connected for startCall');
      return;
    }
    if (!currentPartner || !currentUser) {
      console.warn('[ZEGOCloud] Missing partner or user for startCall');
      return;
    }

    console.log(`[ZEGOCloud] Initiating ${callType.toUpperCase()} Call to partner:`, currentPartner.name, 'ID:', currentPartner._id);
    s.emit('call:initiate', { receiverId: currentPartner._id, callerInfo: currentUser, callType });
  };

  const answerCall = () => {
    const s = getSocket();
    const currentPartner = useCallStore.getState().partner;
    if (!s || !currentPartner) return;

    console.log('[ZEGOCloud] Answering Call from partner:', currentPartner.name);
    s.emit('call:accept', { callerId: currentPartner._id });
    useCallStore.getState().acceptCall();
  };

  useEffect(() => {
    callWebRTCRef.startCallFn = startCall;
    callWebRTCRef.answerCallFn = answerCall;
  });

  return { startCall, answerCall };
};
