'use client';

import React, { useEffect, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useGroupStore } from '@/store/useGroupStore';
import { fetchApi } from '@/lib/api';
import { User } from '@/types';
import { Search, Users, MessageSquarePlus } from 'lucide-react';

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

  useEffect(() => {
    const loadFriends = async () => {
      try {
        setIsLoading(true);
        const data = await fetchApi('/user/friends');
        setFriends(data.friends || []);
      } catch (err) {
        console.error('Failed to load friends', err);
      } finally {
        setIsLoading(false);
      }
    };

    const loadGroups = async () => {
      try {
        setIsLoading(true);
        const data = await fetchApi('/group/user-groups');
        setGroups(data.groups || []);
      } catch (err) {
        console.error('Failed to load groups', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeTab === 'chats') {
      loadFriends();
    } else if (activeTab === 'groups') {
      loadGroups();
    }
  }, [activeTab, setGroups]);

  const filteredFriends = friends.filter(
    (f) =>
      f.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.friendId.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="w-full md:w-80 bg-slate-900/90 border-r border-slate-800 flex flex-col h-full">
      {/* Header Search */}
      <div className="p-4 border-b border-slate-800">
        <h3 className="text-lg font-bold text-white mb-3">
          {activeTab === 'chats' ? 'Messages' : 'Groups'}
        </h3>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={`Search ${activeTab === 'chats' ? 'friends' : 'groups'}...`}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* List items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading conversations...</div>
        ) : activeTab === 'chats' ? (
          filteredFriends.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <MessageSquarePlus className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              No friends found. Add friends using their Friend ID!
            </div>
          ) : (
            filteredFriends.map((friend) => {
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
                  className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 ${
                    isSelected
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center overflow-hidden border border-slate-600">
                      {friend.profilePic ? (
                        <img src={friend.profilePic} alt={friend.name} className="w-full h-full object-cover" />
                      ) : (
                        friend.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    {friend.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white truncate">{friend.name}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">{friend.friendId}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-400 truncate">
                        {friend.isOnline ? 'Online' : 'Offline'}
                      </p>
                      {unread > 0 && !isSelected && (
                        <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md animate-pulse">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            No groups found. Create or join a group!
          </div>
        ) : (
          filteredGroups.map((group) => {
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
                className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 ${
                  isSelected
                    ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center overflow-hidden shrink-0">
                  {group.avatar ? (
                    <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white truncate">{group.name}</h4>
                    <span className="text-[10px] bg-slate-800 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                      {group.members.length} members
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-slate-400 truncate">
                      {group.description || 'Group Conversation'}
                    </p>
                    {unread > 0 && !isSelected && (
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md animate-pulse">
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
