'use client';

import React from 'react';
import { useCallStore } from '@/store/useCallStore';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff } from 'lucide-react';
import { getSocket } from '@/hooks/useSocket';

export const ActiveCallScreen: React.FC = () => {
  const { callStatus, partner, isMuted, isSpeakerOn, callDuration, toggleMute, toggleSpeaker, endCall } =
    useCallStore();

  if (callStatus !== 'connected' || !partner) return null;

  const displayName = partner.name || partner.username || 'Unknown';
  const initial = displayName.charAt(0).toUpperCase();

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleEnd = () => {
    const socket = getSocket();
    if (socket && partner) {
      socket.emit('call:end', { partnerId: partner._id, duration: callDuration });
    }
    endCall();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl text-center space-y-8 animate-in fade-in zoom-in duration-200">
        <div className="space-y-4">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 font-bold text-4xl text-white flex items-center justify-center overflow-hidden border-4 border-indigo-400 mx-auto shadow-2xl shadow-indigo-500/40">
            {partner.profilePic ? (
              <img src={partner.profilePic} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white">{displayName}</h3>
            <p className="text-sm text-emerald-400 font-mono font-semibold mt-1">
              {formatDuration(callDuration)}
            </p>
          </div>
        </div>

        {/* Call Controls */}
        <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-800">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
              isMuted
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={handleEnd}
            className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 transition-all hover:scale-105 active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          <button
            onClick={toggleSpeaker}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
              !isSpeakerOn
                ? 'bg-slate-800 text-slate-500 border border-slate-700'
                : 'bg-indigo-600 text-white'
            }`}
            title="Toggle Speaker"
          >
            {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};
