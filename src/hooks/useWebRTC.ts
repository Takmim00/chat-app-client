import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from './useSocket';
import { useCallStore, callWebRTCRef } from '@/store/useCallStore';
import { useAuthStore } from '@/store/useAuthStore';
import { User } from '@/types';
import { toast } from 'sonner';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // STUN servers — public IP discovery
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:global.stun.twilio.com:3478' },

    // TURN relay servers — cross-network (different Wi-Fi / 4G / 5G / firewall)
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: [
        'turns:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global reference to remote audio element for user-gesture unlocking
let globalRemoteAudio: HTMLAudioElement | null = null;

export const unlockAudioPlayback = () => {
  if (globalRemoteAudio) {
    globalRemoteAudio.play().catch(() => {});
  }
};

export const useWebRTC = () => {
  const { callStatus, partner, isMuted, isSpeakerOn, acceptCall } = useCallStore();
  const { user } = useAuthStore();

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const processedCandidatesRef = useRef<Set<string>>(new Set());
  const partnerRef = useRef(partner);
  const userAcceptedRef = useRef(false);
  const localDescriptionRef = useRef<RTCSessionDescriptionInit | null>(null);
  const peerPartnerIdRef = useRef<string | null>(null);

  useEffect(() => {
    partnerRef.current = partner;
  }, [partner]);

  // ── Remote Audio Element Setup ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && !remoteAudioRef.current) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.volume = 1.0;
      (audio as any).playsInline = true;
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
      globalRemoteAudio = audio;
    }
    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.remove();
        remoteAudioRef.current = null;
        globalRemoteAudio = null;
      }
    };
  }, []);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerOn;
    }
  }, [isSpeakerOn]);

  // ── Local Media ─────────────────────────────────────────────────────────────
  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }, []);

  const getMedia = useCallback(async () => {
    try {
      const existing = localStreamRef.current;
      if (existing && existing.active && existing.getAudioTracks().some((t) => t.readyState === 'live')) {
        return existing;
      }
      stopLocalMedia();

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch {
        // Fallback to simple audio if advanced constraints fail on some mobile devices
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }

      // Ensure all audio tracks are enabled
      stream.getAudioTracks().forEach((t) => { t.enabled = !useCallStore.getState().isMuted; });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('[WebRTC getMedia Error]:', err);
      toast.error('Microphone access is required for voice calls.');
      useCallStore.getState().resetCall();
      return null;
    }
  }, [stopLocalMedia]);

  // ── PeerConnection Lifecycle ────────────────────────────────────────────────
  const cleanupPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      console.log('[WebRTC] Closing Peer Connection');
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    pendingOfferRef.current = null;
    localDescriptionRef.current = null;
    iceCandidatesQueueRef.current = [];
    processedCandidatesRef.current.clear();
    userAcceptedRef.current = false;
    peerPartnerIdRef.current = null;
  }, []);

  const getActiveSocket = useCallback(() => getSocket(), []);

  const createPeerConnection = useCallback(
    (targetUserId: string) => {
      cleanupPeerConnection();
      peerPartnerIdRef.current = targetUserId;

      const pc = new RTCPeerConnection(RTC_CONFIG);

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        const s = getActiveSocket();
        if (s && s.connected) {
          console.log('[WebRTC Candidate] Type:', event.candidate.type, '| Protocol:', event.candidate.protocol);
          const candObj = typeof event.candidate.toJSON === 'function' ? event.candidate.toJSON() : event.candidate;
          s.emit('call:ice-candidate', { to: targetUserId, candidate: candObj });
        } else {
          console.warn('[WebRTC Candidate] Socket not connected — candidate queued');
        }
      };

      pc.ontrack = (event) => {
        console.log('[WebRTC Track Received]:', event.track.kind, event.streams);
        const remoteStream = event.streams?.[0] ?? new MediaStream([event.track]);

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.muted = !useCallStore.getState().isSpeakerOn;

          const playAudio = () => {
            remoteAudioRef.current?.play().then(() => {
              console.log('[WebRTC] ✅ Remote audio stream playing successfully!');
            }).catch((err) => {
              console.warn('[WebRTC] Remote audio play error (browser policy):', err);
            });
          };

          playAudio();

          event.track.onunmute = () => {
            console.log('[WebRTC] Track unmuted — playing audio');
            playAudio();
          };
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          console.log('[WebRTC] ✅ Voice P2P stream CONNECTED!');
          if (remoteAudioRef.current) {
            remoteAudioRef.current.play().catch(() => {});
          }
        } else if (pc.connectionState === 'failed') {
          console.warn('[WebRTC] Connection failed — restarting ICE');
          pc.restartIce();
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE state:', pc.iceConnectionState);
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [cleanupPeerConnection, getActiveSocket]
  );

  // ── Socket reconnect: re-send pending call signals ─────────────────────────
  useEffect(() => {
    const handleReconnect = () => {
      const s = getSocket();
      if (!s || !s.connected) return;

      const callState = useCallStore.getState();
      const partnerId = peerPartnerIdRef.current;

      if (!partnerId || !localDescriptionRef.current) return;

      if (callState.callStatus === 'outgoing' && localDescriptionRef.current.type === 'offer') {
        console.log('[WebRTC] Socket reconnected — re-sending call:offer to', partnerId);
        s.emit('call:offer', { to: partnerId, offer: localDescriptionRef.current });
      } else if (callState.callStatus === 'connected' && localDescriptionRef.current.type === 'answer') {
        console.log('[WebRTC] Socket reconnected — re-sending call:answer to', partnerId);
        s.emit('call:answer', { to: partnerId, answer: localDescriptionRef.current });
      }
    };

    const interval = setInterval(() => {
      const s = getSocket();
      if (s) {
        s.off('reconnect', handleReconnect);
        s.on('reconnect', handleReconnect);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // ── ICE Candidate Queue Flusher ─────────────────────────────────────────────
  const flushCandidateQueue = useCallback(async (pc: RTCPeerConnection) => {
    while (iceCandidatesQueueRef.current.length > 0) {
      const cand = iceCandidatesQueueRef.current.shift();
      if (cand?.candidate && !processedCandidatesRef.current.has(cand.candidate)) {
        processedCandidatesRef.current.add(cand.candidate);
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      }
    }
  }, []);

  // ── Answer Processing (Receiver) ────────────────────────────────────────────
  const processAnswer = useCallback(async () => {
    const s = getActiveSocket();
    const currentPartner = partnerRef.current;
    if (!s || !currentPartner || !pendingOfferRef.current) {
      console.warn('[WebRTC processAnswer] Missing socket, partner, or offer');
      return;
    }

    try {
      unlockAudioPlayback();

      const stream = await getMedia();
      if (!stream) { useCallStore.getState().endCall(); return; }

      const pc = createPeerConnection(currentPartner._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await pc.createAnswer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(answer);
      localDescriptionRef.current = answer;

      await flushCandidateQueue(pc);

      s.emit('call:answer', { to: currentPartner._id, answer });
      console.log('[WebRTC] Answer emitted to caller');
    } catch (err) {
      console.error('[WebRTC] processAnswer error:', err);
      toast.error('Failed to connect voice call.');
      useCallStore.getState().endCall();
    }
  }, [getMedia, createPeerConnection, flushCandidateQueue, getActiveSocket]);

  // ── Signaling Event Handlers ────────────────────────────────────────────────
  useEffect(() => {
    const handleOffer = async (data: any) => {
      console.log('[WebRTC] Received offer from:', data.from);
      pendingOfferRef.current = data.offer;
      if (userAcceptedRef.current) {
        console.log('[WebRTC] User had already accepted — processing now');
        userAcceptedRef.current = false;
        await processAnswer();
      }
    };

    const handleAnswer = async (data: any) => {
      console.log('[WebRTC] Received answer from:', data.from);
      const pc = peerConnectionRef.current;
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushCandidateQueue(pc);
        remoteAudioRef.current?.play().catch(() => {});
        useCallStore.getState().acceptCall();
      }
    };

    const handleIceCandidate = async (data: any) => {
      if (!data?.candidate?.candidate) return;
      const candKey = data.candidate.candidate;
      if (processedCandidatesRef.current.has(candKey)) return;

      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription?.type) {
        processedCandidatesRef.current.add(candKey);
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
      } else {
        iceCandidatesQueueRef.current.push(data.candidate);
      }
    };

    const registerSignalingEvents = () => {
      const s = getSocket();
      if (!s) return;
      s.off('call:offer', handleOffer);
      s.off('call:answer', handleAnswer);
      s.off('call:ice-candidate', handleIceCandidate);
      s.on('call:offer', handleOffer);
      s.on('call:answer', handleAnswer);
      s.on('call:ice-candidate', handleIceCandidate);
    };

    registerSignalingEvents();

    const reconnectInterval = setInterval(() => {
      const s = getSocket();
      if (s && s.connected) {
        registerSignalingEvents();
      }
    }, 3000);

    return () => {
      clearInterval(reconnectInterval);
      const s = getSocket();
      if (s) {
        s.off('call:offer', handleOffer);
        s.off('call:answer', handleAnswer);
        s.off('call:ice-candidate', handleIceCandidate);
      }
    };
  }, [processAnswer, flushCandidateQueue]);

  // ── Start Call (Caller) ─────────────────────────────────────────────────────
  const startCall = useCallback(async (targetPartnerUser?: User) => {
    const s = getActiveSocket();
    const currentPartner = targetPartnerUser ?? partner ?? partnerRef.current ?? useCallStore.getState().partner;
    const currentUser = user ?? useAuthStore.getState().user;

    if (!s || !s.connected) {
      toast.error('Connection issue — please wait and try again.');
      console.warn('[WebRTC] Socket not connected for startCall');
      return;
    }
    if (!currentPartner || !currentUser) {
      console.warn('[WebRTC] Missing partner or user');
      return;
    }

    console.log('[WebRTC] Starting call to:', currentPartner.name, 'ID:', currentPartner._id);

    unlockAudioPlayback();

    // 1. Notify receiver immediately
    s.emit('call:initiate', { receiverId: currentPartner._id, callerInfo: currentUser });

    // 2. Acquire mic
    const stream = await getMedia();
    if (!stream) return;

    // 3. Build offer
    const pc = createPeerConnection(currentPartner._id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    localDescriptionRef.current = offer;

    // 4. Send offer
    const freshSocket = getActiveSocket();
    if (freshSocket && freshSocket.connected) {
      freshSocket.emit('call:offer', { to: currentPartner._id, offer });
    } else {
      toast.error('Lost connection while setting up call. Please try again.');
      cleanupPeerConnection();
      useCallStore.getState().endCall();
    }
  }, [partner, user, getMedia, createPeerConnection, cleanupPeerConnection, getActiveSocket]);

  // ── Answer Call (Receiver) ──────────────────────────────────────────────────
  const answerCall = useCallback(async () => {
    const s = getActiveSocket();
    const currentPartner = partnerRef.current;
    if (!s || !currentPartner) return;

    unlockAudioPlayback();

    if (!pendingOfferRef.current) {
      console.log('[WebRTC] Offer not yet received — will process on arrival');
      userAcceptedRef.current = true;
      return;
    }

    await processAnswer();
  }, [processAnswer, getActiveSocket]);

  // ── Mute sync ───────────────────────────────────────────────────────────────
  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !isMuted; });
  }, [isMuted]);

  // ── Cleanup on call end ─────────────────────────────────────────────────────
  useEffect(() => {
    if (callStatus === 'idle' || callStatus === 'ended') {
      cleanupPeerConnection();
      stopLocalMedia();
    }
  }, [callStatus, cleanupPeerConnection, stopLocalMedia]);

  // ── Register global refs ────────────────────────────────────────────────────
  useEffect(() => {
    callWebRTCRef.startCallFn = startCall;
    callWebRTCRef.answerCallFn = answerCall;
  });

  return { startCall, answerCall };
};
