'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useGroupStore } from '@/store/useGroupStore';
import { fetchApi } from '@/lib/api';
import { User } from '@/types';
import { Search, Users, MessageSquarePlus } from 'lucide-react';
import { getSocket } from '@/hooks/useSocket';

export const ConversationList: React.FC = () => {
  const {
    activeTab,
    activeChatPartner,
    setActiveChatPartner,
    unreadCounts,
    clearUnread,
  } = useChatStore();

  const { groups, activeGroup, setActiveGroup, setGroups } = useGroupStore();

  const [friends, setFriends] = useState<User[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastActivityMap, setLastActivityMap] = useState<Record<string, number>>({});

  const loadFriends = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchApi('/friend/list');
      setFriends(data.friends || []);
    } catch (err) {
      console.error('Failed to load friends', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchApi('/group/list');
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Failed to load groups', err);
    } finally {
      setIsLoading(false);
    }
  }, [setGroups]);

  useEffect(() => {
    if (activeTab === 'chats') {
      loadFriends();
    } else if (activeTab === 'groups') {
      loadGroups();
    }
  }, [activeTab, loadFriends, loadGroups]);

  // Listen for real-time messages to bump active conversation to the top
  useEffect(() => {
    const handleNewMessage = (data: any) => {
      const msg = data.message || data;
      const targetId = msg.senderId?._id || msg.chatId || msg.groupId;
      if (targetId) {
        setLastActivityMap((prev) => ({ ...prev, [targetId]: Date.now() }));
      }
    };

    const attachListeners = () => {
      const s = getSocket();
      if (!s) return;
      s.off('message:receive', handleNewMessage);
      s.on('message:receive', handleNewMessage);
      s.off('group:message-receive', handleNewMessage);
      s.on('group:message-receive', handleNewMessage);
    };

    attachListeners();
    const interval = setInterval(attachListeners, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time friend additions
  useEffect(() => {
    const handleFriendsUpdated = () => {
      loadFriends();
    };

    window.addEventListener('friends:updated', handleFriendsUpdated);
    return () => {
      window.removeEventListener('friends:updated', handleFriendsUpdated);
    };
  }, [loadFriends]);

  const filteredFriends = friends.filter(
    (f) =>
      f.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.friendId.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const sortedFriends = [...filteredFriends].sort(
    (a, b) => (lastActivityMap[b._id] || 0) - (lastActivityMap[a._id] || 0)
  );

  const sortedGroups = [...filteredGroups].sort(
    (a, b) => (lastActivityMap[b._id] || 0) - (lastActivityMap[a._id] || 0)
  );

  return (
    <div className="w-full md:w-80 bg-[#111b21] border-r border-[#222d34] flex flex-col h-full">
      {/* Header Search */}
      <div className="p-3 bg-[#111b21] border-b border-[#222d34]">
        <h3 className="text-lg font-bold text-[#e9edef] mb-3.5 px-1">
          {activeTab === 'chats' ? 'Chats' : 'Groups'}
        </h3>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={`Search ${activeTab === 'chats' ? 'chats' : 'groups'}`}
            className="w-full pl-10 pr-4 py-2 bg-[#202c33] border border-transparent rounded-lg text-xs text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition-colors"
          />
        </div>
      </div>

      {/* List items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#8696a0]">Loading conversations...</div>
        ) : activeTab === 'chats' ? (
          sortedFriends.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8696a0]">
              <MessageSquarePlus className="w-8 h-8 text-[#8696a0] mx-auto mb-2" />
              No friends found. Add friends using their Friend ID!
            </div>
          ) : (
            sortedFriends.map((friend) => {
              const isSelected = activeChatPartner?._id === friend._id;
              const unread = unreadCounts[friend._id] || 0;

              return (
                <div
                  key={friend._id}
                  onClick={() => {
                    setActiveChatPartner(friend);
                    setActiveGroup(null);
                    clearUnread(friend._id);
                  }}
                  className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${
                    isSelected
                      ? 'bg-[#2a3942] text-[#e9edef]'
                      : 'hover:bg-[#202c33] text-[#e9edef]'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[#6b7c85] text-white font-bold flex items-center justify-center overflow-hidden shrink-0">
                      {friend.profilePic ? (
                        <img src={friend.profilePic} alt={friend.name} className="w-full h-full object-cover" />
                      ) : (
                        friend.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    {friend.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00a884] border-2 border-[#111b21] rounded-full"></span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-[#e9edef] truncate">{friend.name}</h4>
                      <span className="text-[10px] text-[#8696a0] font-mono">{friend.friendId}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-[#8696a0] truncate">
                        {friend.isOnline ? <span className="text-[#00a884]">online</span> : 'offline'}
                      </p>
                      {unread > 0 && !isSelected && (
                        <span className="w-5 h-5 rounded-full bg-[#00a884] text-[#111b21] text-[10px] font-bold flex items-center justify-center shadow-md">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : sortedGroups.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#8696a0]">
            <Users className="w-8 h-8 text-[#8696a0] mx-auto mb-2" />
            No groups found. Create or join a group!
          </div>
        ) : (
          sortedGroups.map((group) => {
            const isSelected = activeGroup?._id === group._id;
            const unread = unreadCounts[group._id] || 0;

            return (
              <div
                key={group._id}
                onClick={() => {
                  setActiveGroup(group);
                  setActiveChatPartner(null);
                  clearUnread(group._id);
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${
                  isSelected
                    ? 'bg-[#2a3942] text-[#e9edef]'
                    : 'hover:bg-[#202c33] text-[#e9edef]'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-[#6b7c85] text-white font-bold flex items-center justify-center overflow-hidden shrink-0">
                  {group.avatar ? (
                    <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[#e9edef] truncate">{group.name}</h4>
                    <span className="text-[10px] bg-[#202c33] text-[#00a884] px-2 py-0.5 rounded-full font-mono">
                      {group.members.length} members
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-[#8696a0] truncate">
                      {group.description || 'Group Conversation'}
                    </p>
                    {unread > 0 && !isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#00a884] text-[#111b21] text-[10px] font-bold flex items-center justify-center shadow-md">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
