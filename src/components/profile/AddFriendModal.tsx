'use client';

import React, { useState } from 'react';
import { fetchApi } from '@/lib/api';
import { User } from '@/types';
import { X, Search, UserPlus, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({ isOpen, onClose }) => {
  const [friendId, setFriendId] = useState('');
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendId.trim()) return;

    setIsSearching(true);
    setSearchedUser(null);
    setIsSent(false);

    try {
      const data = await fetchApi(`/friend/search?friendId=${encodeURIComponent(friendId.trim())}`);
      setSearchedUser(data.user);
    } catch (err: any) {
      toast.error(err.message || 'No user found with this Friend ID.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchedUser) return;
    setIsSending(true);
    try {
      await fetchApi('/friend/request', {
        method: 'POST',
        body: JSON.stringify({ receiverId: searchedUser._id }),
      });
      toast.success(`Friend request sent to ${searchedUser.name}!`);
      setIsSent(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send request.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" /> Add Friend by ID
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={friendId}
            onChange={(e) => setFriendId(e.target.value.toUpperCase())}
            placeholder="e.g. AUR-X7A9B2"
            required
            className="flex-1 py-3 px-4 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono uppercase text-white focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </form>

        {/* Search Result Card */}
        {searchedUser && (
          <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-600 font-bold text-white flex items-center justify-center overflow-hidden">
                {searchedUser.profilePic ? (
                  <img src={searchedUser.profilePic} alt={searchedUser.name} className="w-full h-full object-cover" />
                ) : (
                  searchedUser.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">{searchedUser.name}</h4>
                <p className="text-xs text-slate-400 font-mono">{searchedUser.friendId}</p>
              </div>
            </div>

            <button
              onClick={handleSendRequest}
              disabled={isSending || isSent}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isSent
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
              }`}
            >
              {isSent ? (
                <>
                  <Check className="w-4 h-4" /> Request Sent
                </>
              ) : (
                'Send Request'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
