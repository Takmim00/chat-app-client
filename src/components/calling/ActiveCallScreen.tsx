'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCallStore } from '@/store/useCallStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getSocket } from '@/hooks/useSocket';
import { PhoneOff, Key, Check } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_ZEGO_APP_ID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID || 1560300605);
const DEFAULT_ZEGO_SERVER_SECRET = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || 'e5ff9b31ef0939a1a435d8ae661aff7e';

export const ActiveCallScreen: React.FC = () => {
  const { callStatus, partner, callDuration, endCall } = useCallStore();
  const { user } = useAuthStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const zegoInstanceRef = useRef<any>(null);

  const [appIdInput, setAppIdInput] = useState<string>('');
  const [secretInput, setSecretInput] = useState<string>('');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [activeAppId, setActiveAppId] = useState<number | null>(DEFAULT_ZEGO_APP_ID);
  const [activeSecret, setActiveSecret] = useState<string | null>(DEFAULT_ZEGO_SERVER_SECRET);

  // Load Zego AppID and Server Secret from env or localStorage
  useEffect(() => {
    const envAppId = process.env.NEXT_PUBLIC_ZEGO_APP_ID;
    const envSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET;

    const storedAppId = typeof window !== 'undefined' ? localStorage.getItem('ZEGO_APP_ID') : null;
    const storedSecret = typeof window !== 'undefined' ? localStorage.getItem('ZEGO_SERVER_SECRET') : null;

    const finalAppId = envAppId ? Number(envAppId) : storedAppId ? Number(storedAppId) : DEFAULT_ZEGO_APP_ID;
    const finalSecret = envSecret || storedSecret || DEFAULT_ZEGO_SERVER_SECRET;

    setActiveAppId(finalAppId);
    setActiveSecret(finalSecret);
    setShowConfigModal(false);
  }, [callStatus]);

  const handleSaveKeys = () => {
    if (!appIdInput.trim() || !secretInput.trim()) {
      toast.error('Please enter both App ID and Server Secret.');
      return;
    }
    const numAppId = Number(appIdInput.trim());
    if (isNaN(numAppId)) {
      toast.error('App ID must be a valid number.');
      return;
    }

    localStorage.setItem('ZEGO_APP_ID', appIdInput.trim());
    localStorage.setItem('ZEGO_SERVER_SECRET', secretInput.trim());

    setActiveAppId(numAppId);
    setActiveSecret(secretInput.trim());
    setShowConfigModal(false);
    toast.success('ZEGOCloud Keys saved successfully!');
  };

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
    if (callStatus !== 'connected' || !partner || !user || !activeAppId || !activeSecret || showConfigModal) return;

    let isMounted = true;

    const initZego = async () => {
      try {
        if (typeof window !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
          if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            toast.error('Microphone/Camera access requires HTTPS or localhost connection.');
          } else {
            toast.error('Microphone/Camera is blocked by your browser settings.');
          }
        }

        const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt');

        const roomID = [user._id, partner._id].sort().join('_call_');
        const userID = user._id;
        const userName = user.name || user.username || 'User';

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          activeAppId,
          activeSecret,
          roomID,
          userID,
          userName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoInstanceRef.current = zp;

        if (!isMounted || !containerRef.current) return;

        const isVideo = useCallStore.getState().callType === 'video';

        zp.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          turnOnCameraWhenJoining: isVideo,
          turnOnMicrophoneWhenJoining: true,
          showMyCameraToggleButton: isVideo,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: isVideo,
          showScreenSharingButton: isVideo,
          showTextChat: false,
          showUserList: false,
          showPreJoinView: false,
          onLeaveRoom: () => {
            handleEndCall();
          },
        });
      } catch (err: any) {
        console.error('[ZEGOCloud Init Error]:', err);
        toast.error(err?.message || 'ZEGOCloud call initiation failed. Check microphone permissions.');
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
  }, [callStatus, partner?._id, user?._id, activeAppId, activeSecret, showConfigModal]);

  if (callStatus !== 'connected' || !partner) return null;

  const displayName = partner.name || partner.username || 'Unknown';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-2 md:p-6 animate-in fade-in zoom-in duration-200">
      {showConfigModal ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto">
            <Key className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Enter ZEGOCloud Keys</h3>
            <p className="text-xs text-slate-400 mt-1">
              To connect voice call, paste your free App ID and Server Secret from{' '}
              <a href="https://console.zegocloud.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-semibold">
                console.zegocloud.com
              </a>
            </p>
          </div>

          <div className="space-y-3 text-left">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">ZEGO App ID (Number)</label>
              <input
                type="text"
                placeholder="e.g. 123456789"
                value={appIdInput}
                onChange={(e) => setAppIdInput(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">ZEGO Server Secret (32 chars)</label>
              <input
                type="password"
                placeholder="e.g. a1b2c3d4e5f6..."
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleEndCall}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel Call
            </button>
            <button
              onClick={handleSaveKeys}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Save & Join Call
            </button>
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-4xl h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          {/* Top Header */}
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
            <div>
              <h3 className="text-base font-bold text-white">{displayName}</h3>
              <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                {useCallStore.getState().callType === 'video' ? '📹 ZEGOCloud Video Call Active' : '📞 ZEGOCloud Voice Call Active'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfigModal(true)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
                title="Change ZEGO Keys"
              >
                <Key className="w-4 h-4" />
              </button>
              <button
                onClick={handleEndCall}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
              >
                <PhoneOff className="w-4 h-4" /> End Call
              </button>
            </div>
          </div>

          {/* ZEGOCloud Audio Container */}
          <div ref={containerRef} className="w-full h-full flex-1 bg-slate-950" />
        </div>
      )}
    </div>
  );
};
