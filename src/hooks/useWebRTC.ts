import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from './useSocket';
import { useCallStore } from '@/store/useCallStore';
import { useAuthStore } from '@/store/useAuthStore';
import { User } from '@/types';
import { toast } from 'sonner';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useWebRTC = () => {
  const { callStatus, partner, isMuted, acceptCall, endCall } = useCallStore();
  const { user } = useAuthStore();
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const partnerRef = useRef(partner);

  useEffect(() => {
    partnerRef.current = partner;
  }, [partner]);

  // Initialize Remote Audio Element
  useEffect(() => {
    if (typeof window !== 'undefined' && !remoteAudioRef.current) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
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

  const getMedia = useCallback(async () => {
    try {
      if (localStreamRef.current) return localStreamRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      toast.error('Microphone permission required for voice calls.');
      endCall();
      return null;
    }
  }, [endCall]);

  const createPeerConnection = useCallback((targetUserId: string) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const socket = getSocket();

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:ice-candidate', {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received Remote Audio Track:', event.streams);
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, []);

  // Handle Call Signaling Setup
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleOffer = async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      console.log('[WebRTC] Received Call Offer from:', from);
      pendingOfferRef.current = offer;
    };

    const handleAnswer = async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      console.log('[WebRTC] Received Call Answer from:', from);
      const pc = peerConnectionRef.current;
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        acceptCall();
      }
    };

    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      } else if (candidate) {
        iceCandidatesQueueRef.current.push(candidate);
      }
    };

    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
    };
  }, [acceptCall]);

  // Initiate Call (Caller side)
  const startCall = async (targetPartnerUser?: User) => {
    const socket = getSocket();
    const currentPartner = targetPartnerUser || partner || partnerRef.current || useCallStore.getState().partner;
    const currentUser = user || useAuthStore.getState().user;

    if (!socket || !currentPartner || !currentUser) {
      console.warn('[WebRTC startCall] Cannot initiate call. Missing parameters:', {
        hasSocket: Boolean(socket),
        currentPartner,
        currentUser,
      });
      return;
    }

    console.log('[WebRTC] Initiating Call to partner:', currentPartner.name, 'ID:', currentPartner._id);
    const stream = await getMedia();
    if (!stream) return;

    const pc = createPeerConnection(currentPartner._id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Pass logged-in user profile as callerInfo
    socket.emit('call:initiate', { receiverId: currentPartner._id, callerInfo: currentUser });
    socket.emit('call:offer', { to: currentPartner._id, offer });
  };

  // Answer Call (Receiver side)
  const answerCall = async () => {
    const socket = getSocket();
    const currentPartner = partnerRef.current;
    if (!socket || !currentPartner || !pendingOfferRef.current) return;

    console.log('[WebRTC] Answering call from:', currentPartner.name);
    const stream = await getMedia();
    if (!stream) return;

    const pc = createPeerConnection(currentPartner._id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Flush queued ICE candidates
    while (iceCandidatesQueueRef.current.length > 0) {
      const cand = iceCandidatesQueueRef.current.shift();
      if (cand) {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      }
    }

    socket.emit('call:answer', { to: currentPartner._id, answer });
    acceptCall();
  };

  // Mute Microphone
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  // Cleanup WebRTC connection on call end
  useEffect(() => {
    if (callStatus === 'idle' || callStatus === 'ended') {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      pendingOfferRef.current = null;
      iceCandidatesQueueRef.current = [];
    }
  // Register global WebRTC actions to call store
  const { setWebRTCActions } = useCallStore();
  useEffect(() => {
    setWebRTCActions({
      startCallFn: startCall,
      answerCallFn: answerCall,
    });
  }, [startCall, answerCall, setWebRTCActions]);

  return { startCall, answerCall };
};
