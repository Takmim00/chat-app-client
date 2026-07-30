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
    
    // TURN Relay servers for cross-network / mobile 4G-5G / symmetric NAT & firewall traversal
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
  const processedCandidatesRef = useRef<Set<string>>(new Set());
  const partnerRef = useRef(partner);
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

  // Clean local media stream tracks
  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }
  }, []);

  // Get active local microphone media stream
  const getMedia = useCallback(async () => {
    try {
      if (
        localStreamRef.current &&
        localStreamRef.current.active &&
        localStreamRef.current.getAudioTracks().some((t) => t.readyState === 'live')
      ) {
        return localStreamRef.current;
      }

      stopLocalMedia();

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
      toast.error('Microphone access is required for voice calls.');
      useCallStore.getState().resetCall();
      return null;
    }
  }, [stopLocalMedia]);

  // Close and cleanup RTCPeerConnection safely
  const cleanupPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      console.log('[WebRTC] Closing existing Peer Connection');
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
  }, []);

  // Create new RTCPeerConnection instance
  const createPeerConnection = useCallback(
    (targetUserId: string) => {
      // Close any existing connection first to prevent leak or ghost listeners
      cleanupPeerConnection();

      const pc = new RTCPeerConnection(RTC_CONFIG);
      const socket = getSocket();

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log('[WebRTC Candidate Generated] Type:', event.candidate.type, 'Protocol:', event.candidate.protocol);
          socket.emit('call:ice-candidate', {
            to: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('[WebRTC Track Received]:', event.track, 'Streams:', event.streams);
        const remoteStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().then(() => {
            console.log('[WebRTC] Remote Audio Stream Playing!');
          }).catch((err) => {
            console.warn('[WebRTC] Remote audio play error:', err);
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC ConnectionStateChanged]:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          console.log('[WebRTC] Voice Stream CONNECTED Successfully!');
          if (remoteAudioRef.current) {
            remoteAudioRef.current.play().catch(() => {});
          }
        } else if (pc.connectionState === 'failed') {
          console.warn('[WebRTC] Peer connection failed. Restarting ICE...');
          pc.restartIce();
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC ICE State]:', pc.iceConnectionState);
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [cleanupPeerConnection]
  );

  // Process the WebRTC answer on the receiver side
  const processAnswer = useCallback(async () => {
    const socket = getSocket();
    const currentPartner = partnerRef.current;
    if (!socket || !currentPartner || !pendingOfferRef.current) {
      console.warn('[WebRTC processAnswer] Cannot process answer. Missing required objects.');
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

      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }

      const pc = createPeerConnection(currentPartner._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Flush queued ICE candidates cleanly (deduplicated)
      while (iceCandidatesQueueRef.current.length > 0) {
        const cand = iceCandidatesQueueRef.current.shift();
        if (cand && cand.candidate) {
          const candKey = cand.candidate;
          if (!processedCandidatesRef.current.has(candKey)) {
            processedCandidatesRef.current.add(candKey);
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
        }
      }

      socket.emit('call:answer', { to: currentPartner._id, answer });
      console.log('[WebRTC] Answer generated & emitted successfully');
    } catch (err) {
      console.error('[WebRTC] Error processing answer:', err);
      toast.error('Failed to establish voice call stream.');
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

      // If user already accepted the call before offer arrived, process answer now
      if (userAcceptedRef.current) {
        console.log('[WebRTC] User accepted prior to offer arrival — answering now');
        userAcceptedRef.current = false;
        await processAnswer();
      }
    };

    const handleAnswer = async (data: any) => {
      console.log('[WebRTC] Received Call Answer from:', data.from);
      const pc = peerConnectionRef.current;
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

        // Flush queued ICE candidates on caller side
        while (iceCandidatesQueueRef.current.length > 0) {
          const cand = iceCandidatesQueueRef.current.shift();
          if (cand && cand.candidate) {
            const candKey = cand.candidate;
            if (!processedCandidatesRef.current.has(candKey)) {
              processedCandidatesRef.current.add(candKey);
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
          }
        }

        if (remoteAudioRef.current) {
          remoteAudioRef.current.play().catch(() => {});
        }

        acceptCall();
      }
    };

    const handleIceCandidate = async (data: any) => {
      if (!data?.candidate?.candidate) return;
      const candKey = data.candidate.candidate;
      
      // Deduplicate identical ICE candidates
      if (processedCandidatesRef.current.has(candKey)) {
        return;
      }

      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          processedCandidatesRef.current.add(candKey);
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('[WebRTC] Error adding ICE candidate:', e);
        }
      } else {
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
      console.warn('[WebRTC startCall] Missing parameters for startCall');
      return;
    }

    console.log('[WebRTC] Initiating Call to partner:', currentPartner.name, 'ID:', currentPartner._id);

    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    // 1. Emit call:initiate
    socket.emit('call:initiate', { receiverId: currentPartner._id, callerInfo: currentUser });

    // 2. Get local microphone stream
    const stream = await getMedia();
    if (!stream) return;

    // 3. Create peer connection and offer
    const pc = createPeerConnection(currentPartner._id);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
    });
    await pc.setLocalDescription(offer);

    socket.emit('call:offer', { to: currentPartner._id, offer });
  };

  // Answer Call (Receiver side)
  const answerCall = async () => {
    const socket = getSocket();
    const currentPartner = partnerRef.current;
    if (!socket || !currentPartner) return;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    if (!pendingOfferRef.current) {
      console.log('[WebRTC] Offer pending — marked accepted for auto-answer');
      userAcceptedRef.current = true;
      return;
    }

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

  // Cleanup WebRTC connection on call end or idle
  useEffect(() => {
    if (callStatus === 'idle' || callStatus === 'ended') {
      cleanupPeerConnection();
      stopLocalMedia();
    }
  }, [callStatus, cleanupPeerConnection, stopLocalMedia]);

  // Register global WebRTC action refs
  useEffect(() => {
    callWebRTCRef.startCallFn = startCall;
    callWebRTCRef.answerCallFn = answerCall;
  }, [startCall, answerCall]);

  return { startCall, answerCall };
};
