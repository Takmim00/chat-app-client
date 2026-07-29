'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useGroupStore } from '@/store/useGroupStore';
import { useSocket } from '@/hooks/useSocket';
import { OtpLoginForm } from '@/components/auth/OtpLoginForm';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ConversationList } from '@/components/sidebar/ConversationList';
import { FriendRequests } from '@/components/sidebar/FriendRequests';
import { CallHistory } from '@/components/sidebar/CallHistory';
import { ChatArea } from '@/components/chat/ChatArea';
import { IncomingCallModal } from '@/components/calling/IncomingCallModal';
import { OutgoingCallModal } from '@/components/calling/OutgoingCallModal';
import { ActiveCallScreen } from '@/components/calling/ActiveCallScreen';
import { GroupCallScreen } from '@/components/calling/GroupCallScreen';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { AddFriendModal } from '@/components/profile/AddFriendModal';
import { CreateGroupModal } from '@/components/group/CreateGroupModal';
import { GroupSettingsModal } from '@/components/group/GroupSettingsModal';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, isLoading, fetchProfile } = useAuthStore();
  const { activeTab, activeChatPartner } = useChatStore();
  const { activeGroup } = useGroupStore();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupSettingsOpen, setIsGroupSettingsOpen] = useState(false);

  // Initialize socket connection
  useSocket();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-medium text-slate-400">Loading Aurora Messenger...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <OtpLoginForm />;
  }

  const isChatSelected = Boolean(activeChatPartner || activeGroup);

  return (
    <main className="flex flex-col md:flex-row h-[100dvh] w-screen bg-slate-950 overflow-hidden">
      {/* Mobile Top/Bottom Navigation Bar & Desktop Sidebar */}
      <Sidebar
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenAddFriend={() => setIsAddFriendOpen(true)}
        onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
      />

      {/* Secondary List Panel (Hidden on mobile if a chat is active) */}
      <div className={`h-full w-full md:w-80 shrink-0 ${isChatSelected ? 'hidden md:flex' : 'flex'}`}>
        {activeTab === 'chats' || activeTab === 'groups' ? (
          <ConversationList />
        ) : activeTab === 'friends' ? (
          <FriendRequests />
        ) : (
          <CallHistory />
        )}
      </div>

      {/* Active Conversation Main Area (Hidden on mobile if NO chat is active) */}
      <div className={`h-full flex-1 min-w-0 ${!isChatSelected ? 'hidden md:flex' : 'flex'}`}>
        <ChatArea onOpenGroupSettings={() => setIsGroupSettingsOpen(true)} />
      </div>

      {/* WebRTC Voice Call Overlays */}
      <IncomingCallModal />
      <OutgoingCallModal />
      <ActiveCallScreen />
      <GroupCallScreen />

      {/* Modals */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <AddFriendModal isOpen={isAddFriendOpen} onClose={() => setIsAddFriendOpen(false)} />
      <CreateGroupModal isOpen={isCreateGroupOpen} onClose={() => setIsCreateGroupOpen(false)} />
      <GroupSettingsModal isOpen={isGroupSettingsOpen} onClose={() => setIsGroupSettingsOpen(false)} />
    </main>
  );
}
