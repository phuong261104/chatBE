import { FriendshipStatus } from "@modules/friendships/model/model";
import {
  User,
  UserInfoVisibility,
  UserPrivacy,
} from "../model/model";

export type PresenceVisibility = "visible" | "hidden";

export interface VisiblePresence {
  userId: string;
  visibility: PresenceVisibility;
  isOnline: boolean;
  lastSeen: number | null;
}

export const DEFAULT_USER_PRIVACY: UserPrivacy = {
  searchableByEmail: true,
  searchableByPhone: true,
  searchableByUsername: true,
  birthdayVisibility: UserInfoVisibility.FRIENDS,
  phoneVisibility: UserInfoVisibility.FRIENDS,
  avatarVisibility: UserInfoVisibility.EVERYONE,
  showOnline: true,
  showLastSeen: true,
  blockMessagesFromStrangers: false,
};

export class RelationshipPrivacyPolicyV2 {
  constructor(
    private readonly userRepo: any,
    private readonly friendshipRepo: any,
    private readonly blockRepo: any,
  ) {}

  normalizePrivacy(user?: Pick<User, "privacy"> | null): UserPrivacy {
    return {
      ...DEFAULT_USER_PRIVACY,
      ...(user?.privacy || {}),
    };
  }

  async areActiveFriends(userA: string, userB: string): Promise<boolean> {
    if (userA === userB) return true;
    const [a, b] = [userA, userB].sort();
    const friendship = await this.friendshipRepo.findByCond({ userA: a, userB: b });
    return friendship?.status === FriendshipStatus.ACTIVE;
  }

  async hasAnyBlock(userA: string, userB: string): Promise<boolean> {
    if (userA === userB) return false;
    const [blockedByA, blockedByB] = await Promise.all([
      this.blockRepo.findByCond({ blockerId: userA, blockedUserId: userB }),
      this.blockRepo.findByCond({ blockerId: userB, blockedUserId: userA }),
    ]);
    return !!(blockedByA || blockedByB);
  }

  async hiddenByBlock(viewerId: string, targetUserId: string): Promise<boolean> {
    return this.hasAnyBlock(viewerId, targetUserId);
  }

  async canViewField(
    viewerId: string | null | undefined,
    targetUser: User,
    visibility: UserInfoVisibility | undefined,
  ): Promise<boolean> {
    if (!viewerId) return visibility === UserInfoVisibility.EVERYONE;
    if (viewerId === targetUser.id) return true;
    if (await this.hiddenByBlock(viewerId, targetUser.id)) return false;

    const effectiveVisibility = visibility || UserInfoVisibility.EVERYONE;
    if (effectiveVisibility === UserInfoVisibility.EVERYONE) return true;
    if (effectiveVisibility === UserInfoVisibility.ONLY_ME) return false;
    return this.areActiveFriends(viewerId, targetUser.id);
  }

  async sanitizePublicProfile(viewerId: string | null | undefined, targetUser: User): Promise<Record<string, unknown>> {
    const privacy = this.normalizePrivacy(targetUser);
    const canViewAvatar = await this.canViewField(viewerId, targetUser, privacy.avatarVisibility);
    const canViewPhone = await this.canViewField(viewerId, targetUser, privacy.phoneVisibility);
    const canViewBirthday = await this.canViewField(viewerId, targetUser, privacy.birthdayVisibility);

    return {
      id: targetUser.id,
      displayName: targetUser.displayName,
      username: targetUser.username,
      avatarUrl: canViewAvatar ? targetUser.avatarUrl : undefined,
      coverUrl: canViewAvatar ? (targetUser as any).coverUrl : undefined,
      bio: targetUser.bio,
      birthday: canViewBirthday ? (targetUser as any).birthday : undefined,
      gender: (targetUser as any).gender,
      phone: canViewPhone ? targetUser.phone : undefined,
      verified: targetUser.verified,
    };
  }

  async canViewPresence(viewerId: string, targetUserId: string): Promise<boolean> {
    if (viewerId === targetUserId) return true;
    const [viewer, target] = await Promise.all([
      this.userRepo.get(viewerId),
      this.userRepo.get(targetUserId),
    ]);
    if (!viewer || !target) return false;
    if (await this.hiddenByBlock(viewerId, targetUserId)) return false;

    const viewerPrivacy = this.normalizePrivacy(viewer);
    const targetPrivacy = this.normalizePrivacy(target);
    return !!(
      viewerPrivacy.showOnline &&
      viewerPrivacy.showLastSeen &&
      targetPrivacy.showOnline &&
      targetPrivacy.showLastSeen
    );
  }

  async applyPresenceVisibility(
    viewerId: string,
    targetUserId: string,
    presence: { isOnline: boolean; lastSeen: number | null },
  ): Promise<VisiblePresence> {
    const canView = await this.canViewPresence(viewerId, targetUserId);
    if (!canView) {
      return {
        userId: targetUserId,
        visibility: "hidden",
        isOnline: false,
        lastSeen: null,
      };
    }

    return {
      userId: targetUserId,
      visibility: "visible",
      isOnline: presence.isOnline,
      lastSeen: presence.lastSeen,
    };
  }

  async canReceiveStrangerMessage(senderId: string, receiverId: string): Promise<boolean> {
    if (await this.areActiveFriends(senderId, receiverId)) return true;
    const receiver = await this.userRepo.get(receiverId);
    if (!receiver) return false;
    return !this.normalizePrivacy(receiver).blockMessagesFromStrangers;
  }

  async canViewJournal(viewerId: string, authorId: string): Promise<boolean> {
    if (viewerId === authorId) return true;
    return !(await this.hiddenByBlock(viewerId, authorId));
  }
}
