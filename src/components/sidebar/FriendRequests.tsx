'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import { FriendRequest } from '@/types';
import { Check, X, UserCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';

export const FriendRequests: React.FC = () => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchApi('/friend/requests');
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to load friend requests', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Listen for real-time incoming friend requests
  useEffect(() => {
    const handleRequestsUpdated = () => {
      loadRequests();
    };
    window.addEventListener('friend-requests:updated', handleRequestsUpdated);
    return () => {
      window.removeEventListener('friend-requests:updated', handleRequestsUpdated);
    };
  }, [loadRequests]);

  const handleAccept = async (requestId: string) => {
    try {
      await fetchApi('/friend/accept', {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      });
      toast.success('Friend request accepted! Friend added to your chat list.');
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
      window.dispatchEvent(new Event('friends:updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept request.');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await fetchApi('/friend/reject', {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      });
      toast.info('Friend request rejected.');
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request.');
    }
  };

  return (
    <div className="w-full md:w-80 bg-[#111b21] border-r border-[#222d34] flex flex-col h-full">
      <div className="p-4 border-b border-[#222d34]">
        <h3 className="text-lg font-bold text-[#e9edef] flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-[#00a884]" /> Pending Requests
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#8696a0]">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#8696a0]">
            <Clock className="w-8 h-8 text-[#8696a0] mx-auto mb-2 opacity-60" />
            No pending friend requests.
          </div>
        ) : (
          requests.map((req) => {
            const sender = req && typeof req.senderId === 'object' && req.senderId ? req.senderId : null;
            if (!sender) return null;

            const senderName = sender.name || 'Aurora User';
            const senderInitial = senderName.charAt(0).toUpperCase();

            return (
              <div
                key={req._id}
                className="p-3.5 bg-[#202c33] border border-[#222d34] rounded-xl space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#6b7c85] font-bold text-white flex items-center justify-center overflow-hidden shrink-0">
                    {sender.profilePic ? (
                      <img src={sender.profilePic} alt={senderName} className="w-full h-full object-cover" />
                    ) : (
                      senderInitial
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-[#e9edef] truncate">{senderName}</h4>
                    <p className="text-xs text-[#8696a0] font-mono">ID: {sender.friendId || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAccept(req._id)}
                    className="flex-1 py-1.5 bg-[#00a884] hover:bg-[#008f70] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-sm transition-all"
                  >
                    <Check className="w-4 h-4" /> Accept
                  </button>
                  <button
                    onClick={() => handleReject(req._id)}
                    className="flex-1 py-1.5 bg-[#111b21] hover:bg-[#182229] text-[#e9edef] border border-[#222d34] rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
