'use client';

import React, { useState, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { getSocket } from '@/hooks/useSocket';
import { fetchApi } from '@/lib/api';
import { Message } from '@/types';
import { Send, Paperclip, Smile, X } from 'lucide-react';
import { AttachmentModal } from './AttachmentModal';
import { toast } from 'sonner';

export const MessageInput: React.FC = () => {
  const [content, setContent] = useState('');
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  const { activeChatPartner, replyingTo, setReplyingTo, addMessage, updateMessage } = useChatStore();
  const { activeGroup } = useGroupStore();
  const { user } = useAuthStore();

  const emojis = ['😀', '😂', '😍', '🔥', '👍', '❤️', '🎉', '🙌', '😎', '🙏'];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    const socket = getSocket();
    if (!socket) return;

    if (activeChatPartner) {
      socket.emit('typing:start', { receiverId: activeChatPartner._id });
    } else if (activeGroup) {
      socket.emit('group:typing', { groupId: activeGroup._id, isTyping: true, userName: user?.name });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (activeChatPartner) {
        socket.emit('typing:stop', { receiverId: activeChatPartner._id });
      } else if (activeGroup) {
        socket.emit('group:typing', { groupId: activeGroup._id, isTyping: false, userName: user?.name });
      }
    }, 1500);
  };

  const handleSend = async (attachment?: { url: string; name: string; size: number; type: string }) => {
    const textToSend = content.trim();
    if (!textToSend && !attachment) return;
    if (!user) return;

    // Instantly clear input for 0ms delay UI responsiveness
    setContent('');
    const currentReplyTo = replyingTo;
    setReplyingTo(null);
    setShowEmojiPicker(false);

    // Stop typing indicator
    const socket = getSocket();
    if (socket) {
      if (activeChatPartner) socket.emit('typing:stop', { receiverId: activeChatPartner._id });
      else if (activeGroup) socket.emit('group:typing', { groupId: activeGroup._id, isTyping: false, userName: user.name });
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create instant optimistic message
    const optimisticMessage: Message = {
      _id: tempId,
      chatId: activeChatPartner?._id,
      groupId: activeGroup?._id,
      senderId: user,
      content: textToSend,
      type: attachment ? (attachment.type as any) : 'text',
      fileUrl: attachment?.url,
      fileName: attachment?.name,
      fileSize: attachment?.size,
      replyToId: currentReplyTo || undefined,
      isEdited: false,
      isPinned: false,
      deletedFor: [],
      isDeletedForEveryone: false,
      seenBy: [{ userId: user._id, timestamp: new Date().toISOString() }],
      deliveredTo: [{ userId: user._id, timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Add to local UI instantly (0ms response)
    addMessage(optimisticMessage);

    // 2. Emit over socket immediately
    if (socket) {
      if (activeChatPartner) {
        socket.emit('message:send', { receiverId: activeChatPartner._id, message: optimisticMessage });
      } else if (activeGroup) {
        socket.emit('group:message-send', { groupId: activeGroup._id, message: optimisticMessage });
      }
    }

    // 3. Persist to DB in background
    try {
      const payload = {
        chatId: activeChatPartner?._id,
        groupId: activeGroup?._id,
        content: textToSend,
        type: attachment ? attachment.type : 'text',
        fileUrl: attachment?.url,
        fileName: attachment?.name,
        fileSize: attachment?.size,
        replyToId: currentReplyTo?._id,
      };

      const data = await fetchApi('/message/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Replace temporary optimistic message with saved DB message
      updateMessage({ ...data.message, _id: tempId });
      updateMessage(data.message);
    } catch (err: any) {
      console.error('Failed to persist message:', err);
      toast.error('Failed to sync message to server.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800 relative">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="mb-2 p-2.5 bg-slate-800 border-l-4 border-indigo-500 rounded-r-xl flex items-center justify-between text-xs">
          <div>
            <span className="font-semibold text-indigo-400">Replying to {replyingTo.senderId.name}</span>
            <p className="text-slate-400 truncate max-w-md">{replyingTo.content || '[Attachment]'}</p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Quick Picker */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-4 bg-slate-800 border border-slate-700 p-2 rounded-2xl shadow-xl flex gap-1 z-20">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setContent((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
              className="p-2 hover:bg-slate-700 rounded-xl text-lg transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-center gap-2 overflow-hidden">
        <button
          onClick={() => setIsAttachmentOpen(true)}
          className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
          title="Emojis"
        >
          <Smile className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={content}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 min-w-0 py-2.5 px-4 bg-slate-800 border border-slate-700/60 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          onClick={() => handleSend()}
          disabled={!content.trim()}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      <AttachmentModal
        isOpen={isAttachmentOpen}
        onClose={() => setIsAttachmentOpen(false)}
        onSendAttachment={(attachment) => handleSend(attachment)}
      />
    </div>
  );
};
