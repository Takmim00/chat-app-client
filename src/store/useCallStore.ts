import { create } from 'zustand';
import { User } from '@/types';

export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended';
export type CallType = 'voice' | 'video';

export const callWebRTCRef: {
  startCallFn: ((partner: User, callType?: CallType) => void) | null;
  answerCallFn: (() => void) | null;
} = {
  startCallFn: null,
  answerCallFn: null,
};

interface CallState {
  callStatus: CallStatus;
  callType: CallType;
  partner: User | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  callDuration: number;
  timerIntervalId: any;

  initiateCall: (partner: User, callType?: CallType) => void;
  receiveCall: (caller: User, callType?: CallType) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  resetCall: () => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  callStatus: 'idle',
  callType: 'voice',
  partner: null,
  isMuted: false,
  isSpeakerOn: true,
  callDuration: 0,
  timerIntervalId: null,

  initiateCall: (partner, callType = 'voice') => {
    set({ callStatus: 'outgoing', callType, partner, callDuration: 0 });
  },

  receiveCall: (caller, callType = 'voice') => {
    set({ callStatus: 'incoming', callType, partner: caller, callDuration: 0 });
  },

  acceptCall: () => {
    const { callStatus, timerIntervalId } = get();
    if (callStatus === 'connected') return;
    if (timerIntervalId) clearInterval(timerIntervalId);
    const interval = setInterval(() => {
      set((state) => ({ callDuration: state.callDuration + 1 }));
    }, 1000);
    set({ callStatus: 'connected', timerIntervalId: interval });
  },

  rejectCall: () => {
    get().resetCall();
  },

  endCall: () => {
    const { timerIntervalId } = get();
    if (timerIntervalId) clearInterval(timerIntervalId);
    set({ callStatus: 'ended' });
    setTimeout(() => {
      get().resetCall();
    }, 1500);
  },

  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

  toggleSpeaker: () => set((state) => ({ isSpeakerOn: !state.isSpeakerOn })),

  resetCall: () => {
    const { timerIntervalId } = get();
    if (timerIntervalId) clearInterval(timerIntervalId);
    set({
      callStatus: 'idle',
      callType: 'voice',
      partner: null,
      isMuted: false,
      isSpeakerOn: true,
      callDuration: 0,
      timerIntervalId: null,
    });
  },
}));
