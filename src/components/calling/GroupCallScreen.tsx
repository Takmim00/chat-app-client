'use client';

import React, { useState } from 'react';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Mic, MicOff, PhoneOff, Users } from 'lucide-react';
import { getSocket } from '@/hooks/useSocket';

export const GroupCallScreen: React.FC = () => {
  const { isInGroupCall, setIsInGroupCall, activeGroup, groupCallParticipants } = useGroupStore();
  const { user } = useAuthStore();
  const [isMuted, setIsMuted] = useState(false);

  if (!isInGroupCall || !activeGroup) return null;

  const handleLeaveCall = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('group:call-leave', { groupId: activeGroup._id });
    }
    setIsInGroupCall(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">{activeGroup.name}</h3>
              <p className="text-xs text-indigo-400 font-medium">Group Voice Call Active</p>
            </div>
          </div>
        </div>

        {/* Participants Grid (Up to 8) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 min-h-[220px]">
          {/* Current User */}
          <div className="p-4 bg-slate-800/80 border border-indigo-500/50 rounded-2xl text-center space-y-2 relative">
            <div className="w-16 h-16 rounded-full bg-indigo-600 font-bold text-white flex items-center justify-center overflow-hidden border-2 border-indigo-400 mx-auto">
              {user?.profilePic ? (
                <img src={user.profilePic} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name.charAt(0).toUpperCase()
              )}
            </div>
            <p className="text-xs font-semibold text-white truncate">{user?.name} (You)</p>
            {isMuted && <span className="absolute top-2 right-2 text-rose-400"><MicOff className="w-3.5 h-3.5" /></span>}
          </div>

          {/* Other Participants */}
          {groupCallParticipants.map((p) => (
            <div key={p.userId} className="p-4 bg-slate-800/80 border border-slate-700/60 rounded-2xl text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-slate-700 font-bold text-white flex items-center justify-center overflow-hidden border-2 border-slate-600 mx-auto">
                {p.profilePic ? (
                  <img src={p.profilePic} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  p.name.charAt(0).toUpperCase()
                )}
              </div>
              <p className="text-xs font-semibold text-white truncate">{p.name}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={handleLeaveCall}
            className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40"
            title="Leave Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
