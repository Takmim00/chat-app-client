'use client';

import React, { useState, useCallback, useRef } from 'react';
import { fetchApi } from '@/lib/api';
import { User } from '@/types';
import { X, Search, UserPlus, Check, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sentUserIds, setSentUserIds] = useState<Set<string>>(new Set());
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const data = await fetchApi(`/friend/search?query=${encodeURIComponent(searchQuery.trim())}`);
      setResults(data.users || (data.user ? [data.user] : []));
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  if (!isOpen) return null;

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 350);
  };

  const handleSendRequest = async (targetUser: User) => {
    setSendingUserId(targetUser._id);
    try {
      await fetchApi('/friend/request', {
        method: 'POST',
        body: JSON.stringify({ receiverId: targetUser._id }),
      });
      toast.success(`Friend request sent to ${targetUser.name}!`);
      setSentUserIds((prev) => new Set(prev).add(targetUser._id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to send friend request.');
    } finally {
      setSendingUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#202c33] border border-[#222d34] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222d34] pb-3 shrink-0">
          <h3 className="text-base font-semibold text-[#e9edef] flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#00a884]" /> Add Friend
          </h3>
          <button onClick={onClose} className="p-1.5 text-[#8696a0] hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time Search Input */}
        <div className="relative shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search by Name, Username or Friend ID..."
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 bg-[#111b21] border border-[#222d34] rounded-lg text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition-colors"
          />
        </div>

        {/* Suggestions List Container */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
          {isSearching && (
            <div className="flex items-center justify-center py-8 text-xs text-[#8696a0] gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#00a884]" />
              <span>Searching for suggestions...</span>
            </div>
          )}

          {!isSearching && hasSearched && results.length === 0 && (
            <div className="text-center py-8 text-xs text-[#8696a0]">
              <Users className="w-8 h-8 text-[#8696a0] mx-auto mb-2 opacity-60" />
              No users found matching "{query}"
            </div>
          )}

          {!isSearching && !hasSearched && (
            <div className="text-center py-8 text-xs text-[#8696a0]">
              Type a name (e.g. John), username, or Friend ID (e.g. AUR-XXXXXX) to view suggestions.
            </div>
          )}

          {!isSearching &&
            results.map((targetUser) => {
              const isSent = sentUserIds.has(targetUser._id);
              const isSending = sendingUserId === targetUser._id;

              return (
                <div
                  key={targetUser._id}
                  className="p-3 bg-[#111b21] border border-[#222d34] rounded-lg flex items-center justify-between transition-colors hover:bg-[#182229]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#6b7c85] font-bold text-white flex items-center justify-center overflow-hidden shrink-0">
                      {targetUser.profilePic ? (
                        <img src={targetUser.profilePic} alt={targetUser.name} className="w-full h-full object-cover" />
                      ) : (
                        targetUser.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-[#e9edef] truncate">{targetUser.name}</h4>
                      <p className="text-[11px] text-[#8696a0] truncate font-mono">
                        @{targetUser.username} • {targetUser.friendId}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSendRequest(targetUser)}
                    disabled={isSending || isSent}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      isSent
                        ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40'
                        : 'bg-[#00a884] hover:bg-[#008f70] text-white shadow-sm disabled:opacity-50'
                    }`}
                  >
                    {isSending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isSent ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Sent
                      </>
                    ) : (
                      'Add Friend'
                    )}
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
