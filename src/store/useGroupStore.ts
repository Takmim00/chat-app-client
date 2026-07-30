import { create } from 'zustand';
import { Group, User } from '@/types';

interface GroupState {
  groups: Group[];
  activeGroup: Group | null;
  isInGroupCall: boolean;
  groupCallParticipants: { userId: string; name: string; socketId: string; profilePic?: string }[];

  setGroups: (groups: Group[]) => void;
  setActiveGroup: (group: Group | null) => void;
  addGroup: (group: Group) => void;
  updateGroup: (group: Group) => void;
  setIsInGroupCall: (inCall: boolean) => void;
  setGroupCallParticipants: (participants: any[]) => void;
  addGroupCallParticipant: (participant: any) => void;
  removeGroupCallParticipant: (userId: string) => void;
}

export const useGroupStore = create<GroupState>((set) => ({
  groups: [],
  activeGroup: null,
  isInGroupCall: false,
  groupCallParticipants: [],

  setGroups: (groups) => set({ groups }),

  setActiveGroup: (group) => {
    set({ activeGroup: group });
  },

  addGroup: (group) => set((state) => ({ groups: [group, ...state.groups] })),

  updateGroup: (updatedGroup) =>
    set((state) => ({
      groups: state.groups.map((g) => (g._id === updatedGroup._id ? updatedGroup : g)),
      activeGroup: state.activeGroup?._id === updatedGroup._id ? updatedGroup : state.activeGroup,
    })),

  setIsInGroupCall: (inCall) => set({ isInGroupCall: inCall }),

  setGroupCallParticipants: (participants) => set({ groupCallParticipants: participants }),

  addGroupCallParticipant: (participant) =>
    set((state) => {
      if (state.groupCallParticipants.some((p) => p.userId === participant.userId)) return state;
      return { groupCallParticipants: [...state.groupCallParticipants, participant] };
    }),

  removeGroupCallParticipant: (userId) =>
    set((state) => ({
      groupCallParticipants: state.groupCallParticipants.filter((p) => p.userId !== userId),
    })),
}));
