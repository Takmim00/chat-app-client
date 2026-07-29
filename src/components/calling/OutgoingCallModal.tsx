'use client';

import React from 'react';
import { useCallStore } from '@/store/useCallStore';
import { PhoneOff } from 'lucide-react';
import { getSocket } from '@/hooks/useSocket';

export const OutgoingCallModal: React.FC = () => {
  const { callStatus, partner, endCall } = useCallStore();

  if (callStatus !== 'outgoing' || !partner) return null;

  const handleCancelCall = () => {
    const socket = getSocket();
    if (socket && partner) {
      socket.emit('call:end', { partnerId: partner._id });
    }
    endCall();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full bg-indigo-600 font-bold text-3xl text-white flex items-center justify-center overflow-hidden border-4 border-indigo-400 mx-auto shadow-xl shadow-indigo-500/30">
            {partner.profilePic ? (
              <img src={partner.profilePic} alt={partner.name} className="w-full h-full object-cover" />
            ) : (
              partner.name.charAt(0).toUpperCase()
            )}
          </div>
          <span className="absolute inset-0 rounded-full border-4 border-indigo-500/60 animate-ping"></span>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white">{partner.name}</h3>
          <p className="text-xs text-indigo-400 font-medium mt-1 animate-pulse">Calling...</p>
        </div>

        <div className="flex justify-center pt-2">
          <button
            onClick={handleCancelCall}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-all hover:scale-110 active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
