'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface VoicePlayerProps {
  src: string;
  isMe?: boolean;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ src, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  // 22 realistic sound wave height percentages
  const barHeights = [30, 45, 75, 90, 60, 40, 85, 100, 70, 50, 80, 95, 65, 45, 85, 100, 60, 40, 75, 55, 35, 25];

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-3xl min-w-[220px] max-w-xs shadow-md select-none ${
      isMe
        ? 'bg-emerald-500 text-white'
        : 'bg-slate-800 text-white border border-slate-700/80'
    }`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 shadow-md ${
          isMe
            ? 'bg-white text-emerald-600 hover:bg-slate-100'
            : 'bg-emerald-500 text-white hover:bg-emerald-400'
        }`}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      {/* Interactive Waveform Bars */}
      <div
        className="flex-1 flex items-center gap-[3px] h-8 cursor-pointer py-1"
        onClick={(e) => {
          if (!audioRef.current || duration <= 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const pct = Math.max(0, Math.min(1, clickX / rect.width));
          audioRef.current.currentTime = pct * duration;
        }}
      >
        {barHeights.map((h, i) => {
          const barPct = (i / barHeights.length) * 100;
          const isActive = barPct <= progressPercent;
          return (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className={`w-1 rounded-full transition-colors duration-150 ${
                isActive
                  ? isMe ? 'bg-white' : 'bg-emerald-400'
                  : isMe ? 'bg-emerald-700/60' : 'bg-slate-600/60'
              }`}
            />
          );
        })}
      </div>

      {/* Duration Counter */}
      <span className="text-xs font-mono font-bold shrink-0 opacity-90">
        {isPlaying ? formatTime(currentTime) : formatTime(duration || currentTime)}
      </span>
    </div>
  );
};
