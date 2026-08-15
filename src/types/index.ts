export interface User {
  _id: string;
  email: string;
  name: string;
  username: string;
  profilePic?: string;
  bio?: string;
  friendId: string;
  friends?: User[];
  blockedUsers?: string[];
  isOnline?: boolean;
  lastSeen?: string;
}

export interface FriendRequest {
  _id: string;
  senderId: User;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface SeenDeliveredInfo {
  userId: string;
  timestamp: string;
}

export interface Message {
  _id: string;
  chatId?: string;
  groupId?: string;
  senderId: User;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'system' | 'call';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  callDuration?: number;
  callStatus?: 'completed' | 'missed' | 'rejected' | 'cancelled';
  replyToId?: Message;
  isEdited: boolean;
  isPinned: boolean;
  deletedFor: string[];
  isDeletedForEveryone: boolean;
  seenBy: SeenDeliveredInfo[];
  deliveredTo: SeenDeliveredInfo[];
  mentions?: User[];
  reactions?: Reaction[];
  isForwarded?: boolean;
  forwardedFrom?: User;
  isFailed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  _id: string;
  groupId: string;
  name: string;
  avatar?: string;
  description?: string;
  ownerId: User;
  admins: User[];
  members: User[];
  bannedMembers?: string[];
  privacy: 'public' | 'private';
  inviteLinkCode: string;
  pinnedMessageIds?: Message[];
  createdAt: string;
}

export interface CallLog {
  _id: string;
  callerId: User;
  receiverId?: User;
  groupId?: Group;
  isGroupCall: boolean;
  startTime: string;
  endTime?: string;
  duration: number;
  status: 'completed' | 'missed' | 'rejected' | 'cancelled';
  createdAt: string;
}

export type ActiveTab = 'chats' | 'groups' | 'friends' | 'calls';
