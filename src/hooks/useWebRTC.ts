import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from './useSocket';
import { useCallStore, callWebRTCRef } from '@/store/useCallStore';
import { useAuthStore } from '@/store/useAuthStore';
import { User } from '@/types';
import { toast } from 'sonner';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // STUN servers for public IP discovery
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    
    // TURN servers for cross-network / symmetric NAT / firewall traversal (relays media across different IPs & mobile networks)
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
  const { callStatus, partner, isMuted, isSpeakerOn, acceptCall, endCall } = useCallStore();
  const { user } = useAuthStore();
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const partnerRef = useRef(partner);
  // Track if user has clicked Accept before the WebRTC offer arrived
  const userAcceptedRef = useRef(false);

  useEffect(() => {
    partnerRef.current = partner;
  }, [partner]);

  // Initialize Remote Audio Element with autoplay and playsinline
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

  // Sync speaker on/off to remote audio element
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerOn;
    }
  }, [isSpeakerOn]);

  const getMedia = useCallback(async () => {
    try {
      if (localStreamRef.current) return localStreamRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('[WebRTC getMedia Error]:', err);
      toast.error('Microphone permission required for voice calls. Check browser settings.');
      useCallStore.getState().resetCall();
      return null;
    }
  }, []);

  const createPeerConnection = useCallback((targetUserId: string) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const socket = getSocket();

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log('[WebRTC Candidate] Type:', event.candidate.type, 'Protocol:', event.candidate.protocol, 'Emitting to:', targetUserId);
        socket.emit('call:ice-candidate', {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC Track Received]:', event.track, 'Streams:', event.streams);
      // Fallback: Use event.streams[0] if present, or construct a new MediaStream from event.track
      const remoteStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
      
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().then(() => {
          console.log('[WebRTC] Remote Audio Playing Successfully!');
        }).catch((err) => {
          console.warn('[WebRTC] Remote audio play error / autoplay restriction:', err);
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC ConnectionStateChanged]:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('[WebRTC] Peer connection ESTABLISHED successfully!');
        if (remoteAudioRef.current) {
          remoteAudioRef.current.play().catch(() => {});
        }
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn('[WebRTC] Connection state is:', pc.connectionState);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC ICE StateChanged]:', pc.iceConnectionState);
    };

    peerConnectionRef.current = pc;
    return pc;
  }, []);

  // Process the WebRTC answer on the receiver side
  const processAnswer = useCallback(async () => {
    const socket = getSocket();
    const currentPartner = partnerRef.current;
    if (!socket || !currentPartner || !pendingOfferRef.current) {
      console.warn('[WebRTC processAnswer] Missing required data:', {
        hasSocket: Boolean(socket),
        hasPartner: Boolean(currentPartner),
        hasOffer: Boolean(pendingOfferRef.current),
      });
      return;
    }

    console.log('[WebRTC] Processing answer for call from:', currentPartner.name);

    try {
      const stream = await getMedia();
      if (!stream) {
        toast.error('Could not access microphone. Call cannot be connected.');
        useCallStore.getState().endCall();
        return;
      }

      // Pre-unlock remote audio element on user accept click
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }

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
      console.log('[WebRTC] Answer created & sent successfully');
    } catch (err) {
      console.error('[WebRTC] Error processing answer:', err);
      toast.error('Failed to connect call. Please try again.');
      useCallStore.getState().endCall();
    }
  }, [getMedia, createPeerConnection]);

  // Handle Call Signaling Setup
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleOffer = async (data: any) => {
      console.log('[WebRTC] Received Call Offer from:', data.from);
      pendingOfferRef.current = data.offer;

      // If user already clicked Accept before the offer arrived, process the answer now
      if (userAcceptedRef.current) {
        console.log('[WebRTC] User already accepted — processing answer now');
        userAcceptedRef.current = false;
        await processAnswer();
      }
    };

    const handleAnswer = async (data: any) => {
      console.log('[WebRTC] Received Call Answer from:', data.from);
      const pc = peerConnectionRef.current;
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

        // Flush any queued ICE candidates on the caller side
        while (iceCandidatesQueueRef.current.length > 0) {
          const cand = iceCandidatesQueueRef.current.shift();
          if (cand) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
        }

        // Try to unlock/play remote audio
        if (remoteAudioRef.current) {
          remoteAudioRef.current.play().catch(() => {});
        }

        // acceptCall is idempotent — safe to call even if already connected
        acceptCall();
      }
    };

    const handleIceCandidate = async (data: any) => {
      console.log('[WebRTC] Received ICE candidate from:', data.from);
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('[WebRTC] Error adding ICE candidate:', e);
        }
      } else if (data?.candidate) {
        iceCandidatesQueueRef.current.push(data.candidate);
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
  }, [acceptCall, processAnswer]);

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
    
    // 1. Pre-unlock remote audio element on user click
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    // 2. Emit call:initiate IMMEDIATELY so recipient receives incoming call modal instantly!
    socket.emit('call:initiate', { receiverId: currentPartner._id, callerInfo: currentUser });

    // 3. Get microphone media and generate WebRTC offer
    const stream = await getMedia();
    if (!stream) return;

    const pc = createPeerConnection(currentPartner._id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
    });
    await pc.setLocalDescription(offer);

    socket.emit('call:offer', { to: currentPartner._id, offer });
  };

  // Answer Call (Receiver side) — called when user clicks Accept
  const answerCall = async () => {
    const socket = getSocket();
    const currentPartner = partnerRef.current;
    if (!socket || !currentPartner) return;

    // Pre-unlock remote audio element on user accept click
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    // If the WebRTC offer hasn't arrived yet, set a flag and process when it arrives
    if (!pendingOfferRef.current) {
      console.log('[WebRTC] Offer not yet received — marking accepted, will process when offer arrives');
      userAcceptedRef.current = true;
      return;
    }

    // Offer is available — process the answer immediately
    await processAnswer();
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
      userAcceptedRef.current = false;
    }
  }, [callStatus]);

  // Register global WebRTC action refs cleanly without triggering Zustand re-renders
  useEffect(() => {
    callWebRTCRef.startCallFn = startCall;
    callWebRTCRef.answerCallFn = answerCall;
  }, [startCall, answerCall]);

  return { startCall, answerCall };
};
