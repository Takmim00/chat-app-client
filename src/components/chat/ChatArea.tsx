'use client';

import React, { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useCallStore } from '@/store/useCallStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { getSocket } from '@/hooks/useSocket';
import { fetchApi } from '@/lib/api';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { PinnedBanner } from './PinnedBanner';
import { Phone, Users, Info, Sparkles, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface ChatAreaProps {
  onOpenGroupSettings: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onOpenGroupSettings }) => {
  const { activeChatPartner, setActiveChatPartner, messages, setMessages, typingUsers } = useChatStore();
  const { activeGroup, setActiveGroup, setIsInGroupCall } = useGroupStore();
  const { initiateCall } = useCallStore();
  const { startCall } = useWebRTC();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Join group socket room & fetch messages when active chat changes
  useEffect(() => {
    const socket = getSocket();
    const loadMessages = async () => {
      try {
        if (activeChatPartner) {
          const data = await fetchApi(`/message/direct/${activeChatPartner._id}`);
          setMessages(data.messages || []);
        } else if (activeGroup) {
          if (socket) {
            socket.emit('group:join', { groupId: activeGroup._id });
          }
          const data = await fetchApi(`/message/group/${activeGroup._id}`);
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load chat messages', err);
      }
    };
    loadMessages();
  }, [activeChatPartner, activeGroup, setMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartVoiceCall = () => {
    if (activeChatPartner) {
      initiateCall(activeChatPartner);
      startCall(activeChatPartner);
    } else if (activeGroup) {
      setIsInGroupCall(true);
      toast.info('Starting Group Voice Call...');
    }
  };

  const handleBackToConversations = () => {
    if (activeGroup) {
      const socket = getSocket();
      if (socket) {
        socket.emit('group:leave', { groupId: activeGroup._id });
      }
    }
    setActiveChatPartner(null);
    setActiveGroup(null);
  };

  if (!activeChatPartner && !activeGroup) {
    return (
      <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white mb-6 shadow-2xl shadow-indigo-600/30">
          <Sparkles className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to Aurora Messenger</h2>
        <p className="text-sm text-slate-400 max-w-sm">
          Select a friend or group from the sidebar to start real-time messaging and voice calling.
        </p>
      </div>
    );
  }

  const pinnedMessages = messages.filter((m) => m.isPinned);
  const title = activeChatPartner ? activeChatPartner.name : activeGroup?.name;
  const isOnline = activeChatPartner ? activeChatPartner.isOnline : false;
  const isTyping = activeChatPartner && typingUsers.has(activeChatPartner._id);

  return (
    <div className="flex-1 bg-slate-950 flex flex-col h-full overflow-hidden w-full">
      {/* Top Header */}
      <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile Back Button */}
          <button
            onClick={handleBackToConversations}
            className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-indigo-600 font-bold text-white flex items-center justify-center overflow-hidden border border-indigo-400 shrink-0">
            {activeChatPartner ? (
              activeChatPartner.profilePic ? (
                <img src={activeChatPartner.profilePic} alt={title} className="w-full h-full object-cover" />
              ) : (
                title?.charAt(0).toUpperCase()
              )
            ) : (
              <Users className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm md:text-base leading-tight truncate">{title}</h3>
            <p className="text-[11px] md:text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              {activeChatPartner ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                  {isTyping ? <span className="text-indigo-400 font-semibold animate-pulse">Typing...</span> : isOnline ? 'Online' : 'Offline'}
                </>
              ) : (
                <span>{activeGroup?.members.length} Members</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleStartVoiceCall}
            className="p-2.5 md:p-3 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-2xl border border-emerald-500/40 transition-all flex items-center gap-2 text-xs font-semibold shadow-md"
            title="Start Voice Call"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">Voice Call</span>
          </button>

          {activeGroup && (
            <button
              onClick={onOpenGroupSettings}
              className="p-2.5 md:p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-colors"
              title="Group Info"
            >
              <Info className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Pinned Messages Banner */}
      <PinnedBanner pinnedMessages={pinnedMessages} />

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No messages yet. Send a message to start the conversation!
          </div>
        ) : (
          messages.map((message) => <MessageItem key={message._id} message={message} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <MessageInput />
    </div>
  );
};
