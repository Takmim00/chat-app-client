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
    { urls: 'stun:global.stun.twilio.com:3478' },

    // TURN relay servers — cross-network (different Wi-Fi / 4G / 5G / firewall)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
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
  // Store the partner ID used when creating the peer connection
  const peerPartnerIdRef = useRef<string | null>(null);

  useEffect(() => {
    partnerRef.current = partner;
  }, [partner]);

  // ── Remote Audio Element ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && !remoteAudioRef.current) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      (audio as any).playsInline = true;
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
    }
    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.remove();
        remoteAudioRef.current = null;
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
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
    iceCandidatesQueueRef.current = [];
    processedCandidatesRef.current.clear();
    userAcceptedRef.current = false;
    peerPartnerIdRef.current = null;
  }, []);

  // Always get fresh socket — never capture it at creation time
  const getActiveSocket = useCallback(() => getSocket(), []);

  const createPeerConnection = useCallback(
    (targetUserId: string) => {
      cleanupPeerConnection();
      peerPartnerIdRef.current = targetUserId;

      const pc = new RTCPeerConnection(RTC_CONFIG);

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        // Always get the CURRENT socket (not captured old one)
        const s = getActiveSocket();
        if (s && s.connected) {
          console.log('[WebRTC Candidate] Type:', event.candidate.type, '| Protocol:', event.candidate.protocol);
          s.emit('call:ice-candidate', { to: targetUserId, candidate: event.candidate });
        } else {
          console.warn('[WebRTC Candidate] Socket not connected — queuing candidate locally');
        }
      };

      pc.ontrack = (event) => {
        console.log('[WebRTC Track Received]:', event.track.kind);
        const stream = event.streams?.[0] ?? new MediaStream([event.track]);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().then(() => {
            console.log('[WebRTC] Remote audio playing!');
          }).catch(console.warn);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          console.log('[WebRTC] ✅ Voice P2P stream CONNECTED!');
          remoteAudioRef.current?.play().catch(() => {});
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
      const stream = await getMedia();
      if (!stream) { useCallStore.getState().endCall(); return; }

      remoteAudioRef.current?.play().catch(() => {});

      const pc = createPeerConnection(currentPartner._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

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
  // These run once but use refs so they always access fresh state
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

    // Re-register signaling events on every render (socket might have changed after reconnect)
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

    // Re-register when socket reconnects
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

    // Pre-unlock audio
    remoteAudioRef.current?.play().catch(() => {});

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

    // 4. Send offer using CURRENT socket (may differ from when pc was made)
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

    remoteAudioRef.current?.play().catch(() => {});

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

  // ── Register global refs for external triggers ──────────────────────────────
  useEffect(() => {
    callWebRTCRef.startCallFn = startCall;
    callWebRTCRef.answerCallFn = answerCall;
  });

  return { startCall, answerCall };
};
