'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { User, Group, Message } from '@/types';
import { X, Forward, Search, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSocket } from '@/hooks/useSocket';
import { useChatStore } from '@/store/useChatStore';
import { useGroupStore } from '@/store/useGroupStore';

interface ForwardModalProps {
  isOpen: boolean;
  message: Message | null;
  onClose: () => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({ isOpen, message, onClose }) => {
  const [friends, setFriends] = useState<User[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const { groups } = useGroupStore();

  useEffect(() => {
    if (isOpen) {
      fetchApi('/friend/list').then((data) => setFriends(data.friends || [])).catch(() => {});
      setSelectedIds([]);
      setSearchFilter('');
    }
  }, [isOpen]);

  if (!isOpen || !message) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleForward = async () => {
    if (selectedIds.length === 0) return;
    setIsSending(true);

    try {
      for (const targetId of selectedIds) {
        const isGroup = groups.some((g) => g._id === targetId);
        await fetchApi('/message/forward', {
          method: 'POST',
          body: JSON.stringify({
            messageId: message._id,
            targetChatId: isGroup ? undefined : targetId,
            targetGroupId: isGroup ? targetId : undefined,
          }),
        });
      }
      toast.success(`Message forwarded to ${selectedIds.length} conversation${selectedIds.length > 1 ? 's' : ''}!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to forward message.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredFriends = friends.filter(
    (f) => f.name.toLowerCase().includes(searchFilter.toLowerCase())
  );
  const filteredGroups = groups.filter(
    (g) => g.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Forward className="w-5 h-5 text-indigo-400" /> Forward Message
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 text-xs text-slate-300">
          <p className="font-medium text-indigo-400 mb-1">Forwarding:</p>
          <p className="truncate">{message.content || `[${message.type} attachment]`}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search friends & groups..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {filteredFriends.length > 0 && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 pt-1">Friends</p>
          )}
          {filteredFriends.map((friend) => {
            const isSelected = selectedIds.includes(friend._id);
            return (
              <div
                key={friend._id}
                onClick={() => toggleSelect(friend._id)}
                className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-indigo-600/20 border border-indigo-500/40' : 'hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-slate-700 font-bold text-white text-xs flex items-center justify-center overflow-hidden">
                    {friend.profilePic ? (
                      <img src={friend.profilePic} alt={friend.name} className="w-full h-full object-cover" />
                    ) : (
                      friend.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm font-medium text-white">{friend.name}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
            );
          })}

          {filteredGroups.length > 0 && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 pt-2">Groups</p>
          )}
          {filteredGroups.map((group) => {
            const isSelected = selectedIds.includes(group._id);
            return (
              <div
                key={group._id}
                onClick={() => toggleSelect(group._id)}
                className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                  isSelected ? 'bg-indigo-600/20 border border-indigo-500/40' : 'hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 font-bold text-xs flex items-center justify-center overflow-hidden">
                    {group.avatar ? (
                      <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                    ) : (
                      group.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="text-sm font-medium text-white">{group.name}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleForward}
            disabled={selectedIds.length === 0 || isSending}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg disabled:opacity-50"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Forward className="w-4 h-4" />}
            Forward{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
