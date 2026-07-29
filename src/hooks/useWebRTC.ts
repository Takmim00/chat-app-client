import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from './useSocket';
import { useCallStore } from '@/store/useCallStore';
import { toast } from 'sonner';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = () => {
  const { callStatus, partner, isMuted, acceptCall, endCall } = useCallStore();
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Remote Audio Element
  useEffect(() => {
    if (typeof window !== 'undefined' && !remoteAudioRef.current) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      remoteAudioRef.current = audio;
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const socket = getSocket();

    pc.onicecandidate = (event) => {
      if (event.candidate && partner && socket) {
        socket.emit('call:ice-candidate', {
          to: partner._id,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [partner]);

  const getMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      toast.error('Microphone permission denied or device not found.');
      endCall();
      return null;
    }
  }, [endCall]);

  // Handle Call Setup
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !partner) return;

    const handleOffer = async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      if (from !== partner._id) return;
      let pc = peerConnectionRef.current || createPeerConnection();
      const stream = localStreamRef.current || (await getMedia());

      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call:answer', { to: from, answer });
      acceptCall();
    };

    const handleAnswer = async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      if (from !== partner._id) return;
      const pc = peerConnectionRef.current;
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        acceptCall();
      }
    };

    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionRef.current;
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
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
  }, [partner, createPeerConnection, getMedia, acceptCall]);

  // Initiate Call (Offer sender)
  const startCall = async () => {
    const socket = getSocket();
    if (!socket || !partner) return;

    const stream = await getMedia();
    if (!stream) return;

    const pc = createPeerConnection();
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit('call:initiate', { receiverId: partner._id, callerInfo: partner });
    socket.emit('call:offer', { to: partner._id, offer });
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
    }
  }, [callStatus]);

  return { startCall };
};
