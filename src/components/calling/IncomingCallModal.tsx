'use client';

import React from 'react';
import { useCallStore } from '@/store/useCallStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { Phone, PhoneOff, Volume2 } from 'lucide-react';
import { getSocket } from '@/hooks/useSocket';

export const IncomingCallModal: React.FC = () => {
  const { callStatus, partner, rejectCall } = useCallStore();
  const { answerCall } = useWebRTC();

  if (callStatus !== 'incoming' || !partner) return null;

  const handleAccept = () => {
    const socket = getSocket();
    if (socket && partner) {
      socket.emit('call:accept', { callerId: partner._id });
    }
    answerCall();
  };

  const handleReject = () => {
    const socket = getSocket();
    if (socket && partner) {
      socket.emit('call:reject', { callerId: partner._id });
    }
    rejectCall();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-200 relative overflow-hidden">
        {/* Pulsing Ring Background */}
        <div className="absolute inset-0 bg-indigo-600/10 animate-pulse pointer-events-none"></div>

        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full bg-indigo-600 font-bold text-3xl text-white flex items-center justify-center overflow-hidden border-4 border-indigo-400 mx-auto shadow-xl shadow-indigo-500/30">
            {partner.profilePic ? (
              <img src={partner.profilePic} alt={partner.name} className="w-full h-full object-cover" />
            ) : (
              partner.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 p-2 bg-emerald-500 rounded-full text-white shadow-lg animate-bounce">
            <Volume2 className="w-4 h-4" />
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white">{partner.name}</h3>
          <p className="text-xs text-indigo-400 font-medium mt-1">Incoming Voice Call...</p>
        </div>

        <div className="flex items-center justify-center gap-6 pt-2">
          <button
            onClick={handleReject}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-all hover:scale-110 active:scale-95"
            title="Reject Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          <button
            onClick={handleAccept}
            className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition-all hover:scale-110 active:scale-95 animate-pulse"
            title="Accept Call"
          >
            <Phone className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
