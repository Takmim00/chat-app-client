'use client';

import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/api';
import { FriendRequest } from '@/types';
import { Check, X, UserCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';

export const FriendRequests: React.FC = () => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const data = await fetchApi('/friend/requests');
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to load friend requests', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleAccept = async (requestId: string) => {
    try {
      await fetchApi('/friend/accept', {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      });
      toast.success('Friend request accepted!');
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
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
    <div className="w-full md:w-80 bg-slate-900/90 border-r border-slate-800 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-indigo-400" /> Pending Requests
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            No pending friend requests.
          </div>
        ) : (
          requests.map((req) => {
            const sender = req.senderId;
            return (
              <div
                key={req._id}
                className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-2xl space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 font-bold text-white flex items-center justify-center overflow-hidden">
                    {sender.profilePic ? (
                      <img src={sender.profilePic} alt={sender.name} className="w-full h-full object-cover" />
                    ) : (
                      sender.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">{sender.name}</h4>
                    <p className="text-xs text-slate-400 font-mono">ID: {sender.friendId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAccept(req._id)}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-md transition-all"
                  >
                    <Check className="w-4 h-4" /> Accept
                  </button>
                  <button
                    onClick={() => handleReject(req._id)}
                    className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all"
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
