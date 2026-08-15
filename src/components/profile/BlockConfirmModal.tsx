'use client';

import React from 'react';
import { User } from '@/types';
import { ShieldAlert, X } from 'lucide-react';

interface BlockConfirmModalProps {
  isOpen: boolean;
  targetUser: User | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const BlockConfirmModal: React.FC<BlockConfirmModalProps> = ({
  isOpen,
  targetUser,
  onClose,
  onConfirm,
  isLoading,
}) => {
  if (!isOpen || !targetUser) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#202c33] border border-[#222d34] rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#222d34]">
          <h3 className="text-base font-semibold text-[#e9edef] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" /> Block Contact
          </h3>
          <button onClick={onClose} className="p-1 text-[#8696a0] hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#8696a0] leading-relaxed">
          Are you sure you want to block <strong className="text-[#e9edef]">{targetUser.name}</strong>? Blocked contacts will no longer be able to call you or send you messages.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#111b21] hover:bg-[#2a3942] text-[#e9edef] rounded-lg text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-50"
          >
            {isLoading ? 'Blocking...' : 'Block'}
          </button>
        </div>
      </div>
    </div>
  );
};
