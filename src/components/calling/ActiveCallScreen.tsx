'use client';

import React, { useEffect, useRef } from 'react';
import { useCallStore } from '@/store/useCallStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getSocket } from '@/hooks/useSocket';
import { PhoneOff } from 'lucide-react';

const APP_ID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID || 1484647939);
const SERVER_SECRET = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || 'd092d6e3c04f981ff92881a2936798e4';

export const ActiveCallScreen: React.FC = () => {
  const { callStatus, partner, callDuration, endCall } = useCallStore();
  const { user } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const zegoInstanceRef = useRef<any>(null);

  const handleEndCall = () => {
    if (zegoInstanceRef.current) {
      try {
        zegoInstanceRef.current.destroy();
      } catch (e) {
        console.warn('Zego destroy error:', e);
      }
      zegoInstanceRef.current = null;
    }

    const socket = getSocket();
    if (socket && partner) {
      socket.emit('call:end', { partnerId: partner._id, duration: callDuration });
    }
    endCall();
  };

  useEffect(() => {
    if (callStatus !== 'connected' || !partner || !user || !containerRef.current) return;

    let isMounted = true;

    const initZego = async () => {
      try {
        // Dynamically import ZegoUIKitPrebuilt for Next.js SSR compatibility
        const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt');

        const roomID = [user._id, partner._id].sort().join('_call_');
        const userID = user._id;
        const userName = user.name || user.username || 'User';

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
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          turnOnCameraWhenJoining: false,
          turnOnMicrophoneWhenJoining: true,
          showMyCameraToggleButton: false,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showScreenSharingButton: false,
          showTextChat: false,
          showUserList: false,
          showPreJoinView: false,
          onLeaveRoom: () => {
            handleEndCall();
          },
        });
      } catch (err) {
        console.error('[ZEGOCloud Init Error]:', err);
      }
    };

    initZego();

    return () => {
      isMounted = false;
      if (zegoInstanceRef.current) {
        try {
          zegoInstanceRef.current.destroy();
        } catch (e) {}
        zegoInstanceRef.current = null;
      }
    };
  }, [callStatus, partner?._id, user?._id]);

  if (callStatus !== 'connected' || !partner) return null;

  const displayName = partner.name || partner.username || 'Unknown';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-2 md:p-6 animate-in fade-in zoom-in duration-200">
      <div className="relative w-full max-w-4xl h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white">{displayName}</h3>
            <p className="text-xs text-emerald-400 font-semibold mt-0.5">ZEGOCloud Voice Stream Active</p>
          </div>
          <button
            onClick={handleEndCall}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
          >
            <PhoneOff className="w-4 h-4" /> End Call
          </button>
        </div>

        {/* ZEGOCloud Audio Container */}
        <div ref={containerRef} className="w-full h-full flex-1 bg-slate-950" />
      </div>
    </div>
  );
};
