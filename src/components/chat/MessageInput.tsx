'use client';

import React, { useState, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useGroupStore } from '@/store/useGroupStore';
import { getSocket } from '@/hooks/useSocket';
import { fetchApi } from '@/lib/api';
import { Send, Paperclip, Smile, X, Mic } from 'lucide-react';
import { AttachmentModal } from './AttachmentModal';
import { toast } from 'sonner';

export const MessageInput: React.FC = () => {
  const [content, setContent] = useState('');
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  const { activeChatPartner, replyingTo, setReplyingTo, addMessage } = useChatStore();
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
    if (!content.trim() && !attachment) return;

    const payload = {
      chatId: activeChatPartner?._id,
      groupId: activeGroup?._id,
      content: content.trim(),
      type: attachment ? attachment.type : 'text',
      fileUrl: attachment?.url,
      fileName: attachment?.name,
      fileSize: attachment?.size,
      replyToId: replyingTo?._id,
    };

    try {
      const data = await fetchApi('/message/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      addMessage(data.message);

      // Emit over socket
      const socket = getSocket();
      if (socket) {
        if (activeChatPartner) {
          socket.emit('message:send', { receiverId: activeChatPartner._id, message: data.message });
        } else if (activeGroup) {
          socket.emit('group:message-send', { groupId: activeGroup._id, message: data.message });
        }
      }

      setContent('');
      setReplyingTo(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 bg-slate-900 border-t border-slate-800 relative">
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
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsAttachmentOpen(true)}
          className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-3 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition-colors"
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
          className="flex-1 py-3 px-4 bg-slate-800 border border-slate-700/60 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          onClick={() => handleSend()}
          disabled={!content.trim()}
          className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center"
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
