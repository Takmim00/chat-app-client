'use client';

import React, { useEffect, useRef } from 'react';
import { useGroupStore } from '@/store/useGroupStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getSocket } from '@/hooks/useSocket';
import { PhoneOff, Users } from 'lucide-react';

const APP_ID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID || 1484647939);
const SERVER_SECRET = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || 'd092d6e3c04f981ff92881a2936798e4';

export const GroupCallScreen: React.FC = () => {
  const { isInGroupCall, setIsInGroupCall, activeGroup } = useGroupStore();
  const { user } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const zegoInstanceRef = useRef<any>(null);

  const handleLeaveCall = () => {
    if (zegoInstanceRef.current) {
      try {
        zegoInstanceRef.current.destroy();
      } catch (e) {
        console.warn('Zego destroy error:', e);
      }
      zegoInstanceRef.current = null;
    }

    const socket = getSocket();
    if (socket && activeGroup) {
      socket.emit('group:call-leave', { groupId: activeGroup._id });
    }
    setIsInGroupCall(false);
  };

  useEffect(() => {
    if (!isInGroupCall || !activeGroup || !user || !containerRef.current) return;

    let isMounted = true;

    const initZegoGroup = async () => {
      try {
        const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt');

        const roomID = `group_call_${activeGroup._id}`;
        const userID = user._id;
        const userName = user.name || user.username || 'Member';

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          APP_ID,
          SERVER_SECRET,
          roomID,
          userID,
          userName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoInstanceRef.current = zp;

        if (!isMounted || !containerRef.current) return;

        zp.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.GroupCall,
          },
          turnOnCameraWhenJoining: false,
          turnOnMicrophoneWhenJoining: true,
          showMyCameraToggleButton: false,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: false,
          showScreenSharingButton: false,
          showTextChat: false,
          showUserList: true,
          showPreJoinView: false,
          onLeaveRoom: () => {
            handleLeaveCall();
          },
        });
      } catch (err) {
        console.error('[ZEGOCloud Group Init Error]:', err);
      }
    };

    initZegoGroup();

    return () => {
      isMounted = false;
      if (zegoInstanceRef.current) {
        try {
          zegoInstanceRef.current.destroy();
        } catch (e) {}
        zegoInstanceRef.current = null;
      }
    };
  }, [isInGroupCall, activeGroup?._id, user?._id]);

  if (!isInGroupCall || !activeGroup) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-2 md:p-6 animate-in fade-in zoom-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{activeGroup.name}</h3>
              <p className="text-xs text-indigo-400 font-semibold">ZEGOCloud Group Voice Call Active</p>
            </div>
          </div>

          <button
            onClick={handleLeaveCall}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
          >
            <PhoneOff className="w-4 h-4" /> Leave Call
          </button>
        </div>

        {/* ZEGOCloud Group Call Container */}
        <div ref={containerRef} className="w-full h-full flex-1 bg-slate-950" />
      </div>
    </div>
  );
};
