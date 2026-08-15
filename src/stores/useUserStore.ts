import { create } from 'zustand';
import { db } from '@/lib/db';
import { UserProfile } from '@/types/curriculum';

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  
  initialize: () => Promise<void>;
  addXP: (amount: number) => Promise<void>;
  unlockBadge: (badgeId: string) => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  isLoading: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      let profile = await db.userProfile.get('me');
      if (!profile) {
        profile = {
          id: 'me',
          name: 'Student',
          xp: 0,
          level: 1,
          badges: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await db.userProfile.put(profile);
      }
      set({ profile });
    } catch (error) {
      console.error("Failed to initialize user profile:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  addXP: async (amount: number) => {
    const { profile } = get();
    if (!profile) return;
    
    const newXP = profile.xp + amount;
    // Simple leveling curve: 100 XP per level
    const newLevel = Math.floor(newXP / 100) + 1;
    
    const updated = {
      ...profile,
      xp: newXP,
      level: newLevel,
      updatedAt: new Date()
    };
    
    await db.userProfile.put(updated);
    set({ profile: updated });
  },

  unlockBadge: async (badgeId: string) => {
    const { profile } = get();
    if (!profile) return;
    
    if (profile.badges.includes(badgeId)) return;
    
    const updated = {
      ...profile,
      badges: [...profile.badges, badgeId],
      updatedAt: new Date()
    };
    
    await db.userProfile.put(updated);
    set({ profile: updated });
  }
}));
