'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { fetchApi } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { CallLog } from '@/types';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, RefreshCw } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';
import { getSocket } from '@/hooks/useSocket';

export const CallHistory: React.FC = () => {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchApi('/call/history');
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load call history', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh when a call ends (socket event)
  useEffect(() => {
    const refreshOnCallEnd = () => {
      setTimeout(fetchLogs, 1000); // small delay so server has time to save the log
    };

    const attachListeners = () => {
      const s = getSocket();
      if (!s) return;
      s.off('call:ended', refreshOnCallEnd);
      s.on('call:ended', refreshOnCallEnd);
    };

    attachListeners();
    const interval = setInterval(attachListeners, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const getCallIcon = (log: CallLog) => {
    const isMissed = log.status === 'missed' || log.status === 'rejected';
    const isOutgoing = log.callerId?._id === user?._id;
    if (isMissed) return <PhoneMissed className="w-5 h-5" />;
    if (isOutgoing) return <PhoneOutgoing className="w-5 h-5" />;
    return <PhoneIncoming className="w-5 h-5" />;
  };

  const formatDuration = (secs: number) => {
    if (!secs || secs === 0) return null;
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    if (mins === 0) return `${s}s`;
    return `${mins}m ${s > 0 ? `${s}s` : ''}`;
  };

  return (
    <div className="w-full md:w-80 bg-slate-900/90 border-r border-slate-800 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Phone className="w-5 h-5 text-indigo-400" /> Call History
        </h3>
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mx-auto mb-2" />
            Loading call history...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="font-medium text-slate-400 mb-1">No calls yet</p>
            <p>Your call history will appear here.</p>
          </div>
        ) : (
          logs.map((log) => {
            const isOutgoing = log.callerId?._id === user?._id;
            const partner = isOutgoing ? log.receiverId : log.callerId;
            const isMissed = log.status === 'missed' || log.status === 'rejected';
            const duration = formatDuration(log.duration);

            return (
              <div
                key={log._id}
                className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-2xl flex items-center justify-between hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={`p-2.5 rounded-xl ${
                    isMissed
                      ? 'bg-rose-950/80 text-rose-400'
                      : isOutgoing
                        ? 'bg-indigo-950/80 text-indigo-400'
                        : 'bg-emerald-950/80 text-emerald-400'
                  }`}>
                    {getCallIcon(log)}
                  </div>

                  {/* Info */}
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {partner?.name || partner?.username || 'Voice Call'}
                    </h4>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      {isOutgoing ? 'Outgoing' : isMissed ? 'Missed' : 'Incoming'}
                      <span className="text-slate-600">·</span>
                      {formatDate(log.createdAt)} {formatTime(log.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    isMissed
                      ? 'text-rose-400 bg-rose-950/60'
                      : log.status === 'completed'
                        ? 'text-emerald-400 bg-emerald-950/60'
                        : 'text-slate-400 bg-slate-800'
                  }`}>
                    {log.status}
                  </span>
                  {duration && (
                    <p className="text-[10px] text-slate-500 font-mono">{duration}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
