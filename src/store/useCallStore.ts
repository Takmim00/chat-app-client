import { create } from 'zustand';
import { User } from '@/types';

export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended';

export const callWebRTCRef: {
  startCallFn: ((partner: User) => void) | null;
  answerCallFn: (() => void) | null;
} = {
  startCallFn: null,
  answerCallFn: null,
};

interface CallState {
  callStatus: CallStatus;
  partner: User | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  callDuration: number;
  timerIntervalId: any;

  initiateCall: (partner: User) => void;
  receiveCall: (caller: User) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  resetCall: () => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  callStatus: 'idle',
  partner: null,
  isMuted: false,
  isSpeakerOn: true,
  callDuration: 0,
  timerIntervalId: null,

  initiateCall: (partner) => {
    set({ callStatus: 'outgoing', partner, callDuration: 0 });
  },

  receiveCall: (caller) => {
    set({ callStatus: 'incoming', partner: caller, callDuration: 0 });
  },

  acceptCall: () => {
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
      partner: null,
      isMuted: false,
      isSpeakerOn: true,
      callDuration: 0,
      timerIntervalId: null,
    });
  },
}));
