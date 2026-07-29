'use client';

import React from 'react';
import { Message } from '@/types';
import { Pin } from 'lucide-react';

interface PinnedBannerProps {
  pinnedMessages: Message[];
}

export const PinnedBanner: React.FC<PinnedBannerProps> = ({ pinnedMessages }) => {
  if (!pinnedMessages || pinnedMessages.length === 0) return null;

  const latestPinned = pinnedMessages[pinnedMessages.length - 1];

  return (
    <div className="bg-slate-800/90 border-b border-slate-700/60 px-4 py-2 flex items-center justify-between text-xs text-amber-300 backdrop-blur-md">
      <div className="flex items-center gap-2 min-w-0">
        <Pin className="w-4 h-4 fill-amber-400 shrink-0" />
        <div className="truncate">
          <span className="font-semibold text-white mr-1.5">{latestPinned.senderId.name}:</span>
          <span className="text-slate-300">{latestPinned.content || '[Pinned Attachment]'}</span>
        </div>
      </div>
      <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
        {pinnedMessages.length} Pinned
      </span>
    </div>
  );
};
