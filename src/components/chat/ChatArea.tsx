import React, { useEffect, useRef, useState } from 'react';
import { BlockConfirmModal } from '../profile/BlockConfirmModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useCallStore, callWebRTCRef } from '@/store/useCallStore';
import { getSocket } from '@/hooks/useSocket';
import { fetchApi } from '@/lib/api';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { PinnedBanner } from './PinnedBanner';
import { SearchMessages } from './SearchMessages';
import { Phone, Video, Users, Info, Sparkles, ArrowLeft, ShieldAlert, ShieldCheck, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChatAreaProps {
  onOpenGroupSettings: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onOpenGroupSettings }) => {
  const { user, fetchProfile } = useAuthStore();
  const {
    activeChatPartner,
    setActiveChatPartner,
    messages,
    setMessages,
    isMessagesLoading,
    setIsMessagesLoading,
    typingUsers,
    hasMore,
    loadingMore,
    setHasMore,
    setLoadingMore,
    prependMessages,
  } = useChatStore();
  const { activeGroup, setActiveGroup, setIsInGroupCall } = useGroupStore();
  const { initiateCall } = useCallStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const isBlocked = Boolean(
    activeChatPartner &&
    user?.blockedUsers?.some((b: any) => {
      const bId = typeof b === 'object' ? b._id : b;
      return String(bId) === String(activeChatPartner._id);
    })
  );

  const handleBlockConfirm = async () => {
    if (!activeChatPartner) return;
    setIsBlocking(true);
    try {
      await fetchApi('/user/block', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: activeChatPartner._id }),
      });
      toast.success(`${activeChatPartner.name} blocked.`);
      await fetchProfile();
      setIsBlockModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to block user.');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblockUser = async () => {
    if (!activeChatPartner) return;
    try {
      await fetchApi('/user/unblock', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: activeChatPartner._id }),
      });
      toast.success(`${activeChatPartner.name} unblocked.`);
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.message || 'Failed to unblock user.');
    }
  };

  // Join group socket room & fetch messages when active chat changes
  useEffect(() => {
    const socket = getSocket();
    let isCurrent = true;

    const loadMessages = async () => {
      try {
        if (activeChatPartner) {
          const partnerId = activeChatPartner._id;
          const data = await fetchApi(`/message/direct/${partnerId}`);
          if (isCurrent) {
            setMessages(data.messages || data || [], partnerId);
            setHasMore(data.hasMore ?? false);
          }
        } else if (activeGroup) {
          const groupId = activeGroup._id;
          if (socket) {
            socket.emit('group:join', { groupId });
          }
          const data = await fetchApi(`/message/group/${groupId}`);
          if (isCurrent) {
            setMessages(data.messages || data || [], groupId);
            setHasMore(data.hasMore ?? false);
          }
        }
      } catch (err) {
        console.error('Failed to load chat messages', err);
      } finally {
        if (isCurrent) {
          setIsMessagesLoading(false);
        }
      }
    };

    loadMessages();

    return () => {
      isCurrent = false;
    };
  }, [activeChatPartner?._id, activeGroup?._id, setMessages, setHasMore, setIsMessagesLoading]);

  // Automatically emit message:seen for un-seen messages from activeChatPartner
  useEffect(() => {
    const socket = getSocket();
    if (activeChatPartner && socket && messages.length > 0) {
      messages.forEach((msg) => {
        const senderIdStr = typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId;
        if (String(senderIdStr) === String(activeChatPartner._id) && !String(msg._id).startsWith('temp-')) {
          socket.emit('message:seen', { messageId: msg._id, senderId: activeChatPartner._id });
        }
      });
    }
  }, [activeChatPartner, messages]);

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const scrollContainer = scrollContainerRef.current;
    const prevScrollHeight = scrollContainer?.scrollHeight || 0;
    
    try {
      const oldestMsg = messages[0];
      let data;
      if (activeChatPartner) {
        data = await fetchApi(`/message/direct/${activeChatPartner._id}?before=${oldestMsg.createdAt}&limit=50`);
      } else if (activeGroup) {
        data = await fetchApi(`/message/group/${activeGroup._id}?before=${oldestMsg.createdAt}&limit=50`);
      }
      if (data) {
        prependMessages(data.messages || data || []);
        setHasMore(data.hasMore ?? false);
        // Preserve scroll position
        requestAnimationFrame(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            scrollContainer.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container && container.scrollTop < 100 && hasMore && !loadingMore) {
      loadMoreMessages();
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartVoiceCall = () => {
    if (activeChatPartner) {
      initiateCall(activeChatPartner, 'voice');
      if (callWebRTCRef.startCallFn) {
        callWebRTCRef.startCallFn(activeChatPartner, 'voice');
      }
    } else if (activeGroup) {
      setIsInGroupCall(true);
      toast.info('Starting Group Voice Call...');
    }
  };

  const handleStartVideoCall = () => {
    if (activeChatPartner) {
      initiateCall(activeChatPartner, 'video');
      if (callWebRTCRef.startCallFn) {
        callWebRTCRef.startCallFn(activeChatPartner, 'video');
      }
    } else if (activeGroup) {
      setIsInGroupCall(true);
      toast.info('Starting Group Video Call...');
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
        <div className="w-20 h-20 rounded-3xl bg-linear-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white mb-6 shadow-2xl shadow-indigo-600/30">
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
    <div className="flex-1 bg-[#0b141a] flex flex-col h-full overflow-hidden w-full">
      {/* Top Header */}
      <div className="p-3 px-4 bg-[#202c33] border-b border-[#222d34] flex items-center justify-between z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          <button
            onClick={handleBackToConversations}
            className="md:hidden p-2 text-[#8696a0] hover:text-white hover:bg-[#2a3942] rounded-full transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 rounded-full bg-[#6b7c85] font-bold text-white flex items-center justify-center overflow-hidden shrink-0">
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
            <h3 className="font-semibold text-[#e9edef] text-sm md:text-base leading-tight truncate">{title}</h3>
            <p className="text-[11px] md:text-xs text-[#8696a0] flex items-center gap-1.5 mt-0.5">
              {activeChatPartner ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#00a884]' : 'bg-slate-500'}`}></span>
                  {isTyping ? <span className="text-[#00a884] font-semibold animate-pulse">typing...</span> : isOnline ? 'online' : 'offline'}
                </>
              ) : (
                <span>{activeGroup?.members.length} Members</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="p-2 text-[#8696a0] hover:text-white hover:bg-[#2a3942] rounded-full transition-colors"
            title="Search messages"
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            onClick={handleStartVoiceCall}
            className="p-2.5 md:p-3 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-2xl border border-emerald-500/40 transition-all flex items-center gap-2 text-xs font-semibold shadow-md"
            title="Start Voice Call"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">Voice Call</span>
          </button>

          <button
            onClick={handleStartVideoCall}
            className="p-2.5 md:p-3 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-2xl border border-indigo-500/40 transition-all flex items-center gap-2 text-xs font-semibold shadow-md"
            title="Start Video Call"
          >
            <Video className="w-4 h-4" />
            <span className="hidden sm:inline">Video Call</span>
          </button>

          {activeChatPartner && (
            <button
              onClick={() => {
                if (isBlocked) {
                  handleUnblockUser();
                } else {
                  setIsBlockModalOpen(true);
                }
              }}
              className={`p-2 text-[#8696a0] hover:bg-[#2a3942] rounded-full transition-colors ${
                isBlocked ? 'text-emerald-400 hover:text-emerald-300' : 'hover:text-rose-400'
              }`}
              title={isBlocked ? 'Unblock User' : 'Block User'}
            >
              {isBlocked ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </button>
          )}

          {activeGroup && (
            <button
              onClick={onOpenGroupSettings}
              className="p-2 text-[#8696a0] hover:text-white hover:bg-[#2a3942] rounded-full transition-colors"
              title="Group Settings & Members"
            >
              <Info className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {isSearchOpen && <SearchMessages onClose={() => setIsSearchOpen(false)} />}

      {/* Pinned Messages Banner */}
      <PinnedBanner pinnedMessages={pinnedMessages} />

      {/* Messages Scroll Area */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3"
      >
        {loadingMore && (
          <div className="flex justify-center py-3">
            <Loader2 className="w-5 h-5 animate-spin text-[#00a884]" />
          </div>
        )}
        {!hasMore && messages.length > 0 && (
          <div className="text-center py-3 text-[11px] text-[#8696a0]">Beginning of conversation</div>
        )}
        {isMessagesLoading && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-[#8696a0]">
            <Loader2 className="w-7 h-7 animate-spin text-[#00a884]" />
            <span>Loading conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-[#8696a0]">
            No messages yet. Send a message to start the conversation!
          </div>
        ) : (
          messages.map((message) => <MessageItem key={message._id} message={message} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar or Blocked Banner */}
      {isBlocked ? (
        <div className="p-3.5 px-6 bg-[#202c33] border-t border-[#222d34] flex items-center justify-between text-xs animate-in fade-in duration-200">
          <span className="text-[#8696a0]">You blocked this contact. Tap Unblock to send a message.</span>
          <button
            onClick={handleUnblockUser}
            className="px-4 py-2 bg-[#00a884] hover:bg-[#008f70] text-white font-semibold rounded-lg shadow transition-all"
          >
            Unblock
          </button>
        </div>
      ) : (
        <MessageInput />
      )}

      {/* Block Confirmation Modal */}
      <BlockConfirmModal
        isOpen={isBlockModalOpen}
        targetUser={activeChatPartner}
        onClose={() => setIsBlockModalOpen(false)}
        onConfirm={handleBlockConfirm}
        isLoading={isBlocking}
      />
    </div>
  );
};
