import { Request, Response } from "express";
import { v7 } from "uuid";
import { FriendRequestStatus } from "@modules/friend-requests/model/model";
import { ConversationMemberStatus, ConversationType } from "@modules/chat/model/model";
import { User, UserPhoneSchema, UserStatus } from "../../model/model";
import {
  UpdatePrivacyV2DTOSchema,
  UpdateProfileDTOSchema,
} from "../../model/dto";
import { IPresenceUseCase, IUserUseCase } from "../../interface";
import { DynamoUserAvatarHistoryRepository } from "../repository/dynamodb";
import { RelationshipPrivacyPolicyV2 } from "../../usecase/relationship-privacy-policy-v2";

export class UserV2HTTPService {
  constructor(
    private readonly userUseCase: IUserUseCase,
    private readonly presenceUseCase: IPresenceUseCase,
    private readonly userRepo: any,
    private readonly avatarHistoryRepo: DynamoUserAvatarHistoryRepository,
    private readonly privacyPolicy: RelationshipPrivacyPolicyV2,
    private readonly friendshipRepo: any,
    private readonly friendRequestRepo: any,
    private readonly blockRepo: any,
    private readonly conversationRepo: any,
    private readonly conversationMemberRepo: any,
  ) {}

  getMyProfileAPI = async (_req: Request, res: Response) => {
    try {
      const userId = this.currentUserId(res);
      const user = await this.userUseCase.profile(userId);
      const { password, salt, ...safeUser } = user as any;
      return res.status(200).json({
        data: {
          ...safeUser,
          privacy: this.privacyPolicy.normalizePrivacy(user),
        },
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  updateMyProfileAPI = async (req: Request, res: Response) => {
    try {
      const userId = this.currentUserId(res);
      const dto = UpdateProfileDTOSchema.parse(req.body);
      const currentUser = await this.userRepo.get(userId);
      if (!currentUser) return res.status(404).json({ error: "User not found" });

      if (
        dto.avatarUrl !== undefined &&
        currentUser.avatarUrl &&
        currentUser.avatarUrl !== dto.avatarUrl
      ) {
        await this.avatarHistoryRepo.insert({
          id: v7(),
          userId,
          avatarUrl: currentUser.avatarUrl,
          createdAt: new Date(),
        });
      }

      await this.userUseCase.updateProfile({ sub: userId } as any, dto);
      const updated = await this.userRepo.get(userId);
      const { password, salt, ...safeUser } = (updated || currentUser) as any;
      return res.status(200).json({
        data: {
          ...safeUser,
          privacy: this.privacyPolicy.normalizePrivacy(updated || currentUser),
        },
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  updateMyPrivacyAPI = async (req: Request, res: Response) => {
    try {
      const userId = this.currentUserId(res);
      const dto = UpdatePrivacyV2DTOSchema.parse(req.body);
      const user = await this.userRepo.get(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const privacy = {
        ...this.privacyPolicy.normalizePrivacy(user),
        ...dto,
      };
      await this.userRepo.update(userId, { privacy } as any);
      return res.status(200).json({ data: privacy });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  getAvatarHistoryAPI = async (req: Request, res: Response) => {
    try {
      const userId = this.currentUserId(res);
      const limit = Math.min(Number(req.query.limit || 50), 100);
      const items = await this.avatarHistoryRepo.listByUserId(userId, limit);
      return res.status(200).json({ data: items });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  getPublicProfileAPI = async (req: Request, res: Response) => {
    try {
      const viewerId = this.currentUserId(res);
      const target = await this.userRepo.get(req.params.id);
      if (!target || target.status !== UserStatus.ACTIVE) {
        return res.status(404).json({ error: "User not found" });
      }
      if (await this.privacyPolicy.hiddenByBlock(viewerId, target.id)) {
        return res.status(403).json({ error: "Profile is hidden by user relationship" });
      }
      const profile = await this.privacyPolicy.sanitizePublicProfile(viewerId, target);
      return res.status(200).json({ data: profile });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  getPresenceAPI = async (req: Request, res: Response) => {
    try {
      const viewerId = this.currentUserId(res);
      const targetUserId = req.params.id;
      const target = await this.userRepo.get(targetUserId);
      if (!target || target.status !== UserStatus.ACTIVE) {
        return res.status(404).json({ error: "User not found" });
      }
      const presence = await this.presenceUseCase.getUserPresence(targetUserId);
      const data = await this.privacyPolicy.applyPresenceVisibility(viewerId, targetUserId, presence);
      return res.status(200).json({ data });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  searchUsersAPI = async (req: Request, res: Response) => {
    try {
      const viewerId = this.currentUserId(res);
      const q = String(req.query.q || "").trim();
      const limit = Math.min(Number(req.query.limit || 20), 50);
      if (!q) return res.status(200).json({ data: [] });

      const items = await this.userUseCase.searchUsers(q, viewerId, limit * 2);
      const users = await this.loadUsers(items.map((item) => item.id));
      const filtered = [];
      for (const user of users) {
        if (!user || user.status !== UserStatus.ACTIVE) continue;
        if (await this.privacyPolicy.hiddenByBlock(viewerId, user.id)) continue;
        filtered.push(await this.privacyPolicy.sanitizePublicProfile(viewerId, user));
        if (filtered.length >= limit) break;
      }
      return res.status(200).json({ data: filtered });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  searchByPhoneAPI = async (req: Request, res: Response) => {
    try {
      const viewerId = this.currentUserId(res);
      const phone = UserPhoneSchema.parse(String(req.query.phone || "")).replace(/\s+/g, "");
      const user = await this.userRepo.findByCond({ phone, status: UserStatus.ACTIVE } as any);
      if (!user || !this.privacyPolicy.normalizePrivacy(user).searchableByPhone) {
        return res.status(404).json({ error: "User not found" });
      }
      if (await this.privacyPolicy.hiddenByBlock(viewerId, user.id)) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(200).json({
        data: await this.privacyPolicy.sanitizePublicProfile(viewerId, user),
      });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  getFriendSuggestionsAPI = async (req: Request, res: Response) => {
    try {
      const userId = this.currentUserId(res);
      const limit = Math.min(Number(req.query.limit || 20), 50);
      const suggestions = await this.buildFriendSuggestions(userId, limit);
      return res.status(200).json({ data: suggestions });
    } catch (err) {
      return this.sendError(res, err);
    }
  };

  private async buildFriendSuggestions(userId: string, limit: number) {
    const [friendIds, sentRequests, receivedRequests, blockedByMe, blockingMe] = await Promise.all([
      this.friendshipRepo.getFriendIds(userId),
      this.friendRequestRepo.listBySenderId(userId),
      this.friendRequestRepo.listByReceiverId(userId),
      this.blockRepo.findAllByCond({ blockerId: userId }),
      this.blockRepo.findAllByCond({ blockedUserId: userId }),
    ]);

    const excluded = new Set<string>([userId, ...friendIds]);
    for (const req of [...sentRequests, ...receivedRequests]) {
      if (req.status === FriendRequestStatus.PENDING) {
        excluded.add(req.fromUserId);
        excluded.add(req.toUserId);
      }
    }
    for (const block of [...blockedByMe, ...blockingMe]) {
      excluded.add(block.blockerId);
      excluded.add(block.blockedUserId);
    }

    const scores = new Map<string, { mutualFriendIds: Set<string>; sharedGroupIds: Set<string> }>();
    const ensure = (candidateId: string) => {
      if (!scores.has(candidateId)) {
        scores.set(candidateId, { mutualFriendIds: new Set(), sharedGroupIds: new Set() });
      }
      return scores.get(candidateId)!;
    };

    for (const friendId of friendIds) {
      const friendFriendIds = await this.friendshipRepo.getFriendIds(friendId);
      for (const candidateId of friendFriendIds) {
        if (excluded.has(candidateId)) continue;
        ensure(candidateId).mutualFriendIds.add(friendId);
      }
    }

    const myMembers = await this.conversationMemberRepo.findActiveByUserId(userId);
    const activeGroupMembers = myMembers.filter(
      (member: any) => member.status === ConversationMemberStatus.ACTIVE && !member.leftAt,
    );
    for (const member of activeGroupMembers) {
      const conversation = await this.conversationRepo.get(member.conversationId);
      if (!conversation || conversation.type !== ConversationType.GROUP) continue;
      const members = await this.conversationMemberRepo.listByConversationId(member.conversationId);
      for (const other of members) {
        if (
          other.userId === userId ||
          excluded.has(other.userId) ||
          other.leftAt ||
          other.status !== ConversationMemberStatus.ACTIVE
        ) {
          continue;
        }
        ensure(other.userId).sharedGroupIds.add(member.conversationId);
      }
    }

    const candidateIds = Array.from(scores.keys());
    const users = await this.loadUsers(candidateIds);
    const userMap = new Map<string, User>();
    for (const user of users) {
      if (user) userMap.set(user.id, user);
    }

    const ranked: Array<{
      user: User;
      mutualFriendsCount: number;
      mutualFriendIds: string[];
      sharedGroupsCount: number;
      sharedGroupIds: string[];
      score: number;
      reasons: string[];
    }> = [];

    for (const candidateId of candidateIds) {
      const score = scores.get(candidateId)!;
      const user = userMap.get(candidateId);
      if (!user || user.status !== UserStatus.ACTIVE) continue;
      const mutualFriendsCount = score.mutualFriendIds.size;
      const sharedGroupsCount = score.sharedGroupIds.size;
      ranked.push({
        user,
        mutualFriendsCount,
        mutualFriendIds: Array.from(score.mutualFriendIds),
        sharedGroupsCount,
        sharedGroupIds: Array.from(score.sharedGroupIds),
        score: mutualFriendsCount * 10 + sharedGroupsCount * 3,
        reasons: [
          ...(mutualFriendsCount > 0 ? ["mutual_friends"] : []),
          ...(sharedGroupsCount > 0 ? ["shared_groups"] : []),
        ],
      });
    }

    ranked.sort((a, b) => b.score - a.score);

    const result = [];
    for (const item of ranked.slice(0, limit)) {
      result.push({
        ...(await this.privacyPolicy.sanitizePublicProfile(userId, item.user)),
        mutualFriendsCount: item.mutualFriendsCount,
        mutualFriendIds: item.mutualFriendIds,
        sharedGroupsCount: item.sharedGroupsCount,
        sharedGroupIds: item.sharedGroupIds,
        score: item.score,
        reasons: item.reasons,
      });
    }
    return result;
  }

  private async loadUsers(userIds: string[]): Promise<User[]> {
    const uniqueIds = Array.from(new Set(userIds));
    if (uniqueIds.length === 0) return [];
    if (typeof this.userRepo.listByIds === "function") {
      return this.userRepo.listByIds(uniqueIds);
    }
    const users = await Promise.all(uniqueIds.map((id) => this.userRepo.get(id)));
    const result: User[] = [];
    for (const user of users) {
      if (user) result.push(user);
    }
    return result;
  }

  private currentUserId(res: Response): string {
    const userId = (res as any).locals?.requester?.sub;
    if (!userId) {
      const err = new Error("Unauthorized") as Error & { statusCode?: number };
      err.statusCode = 401;
      throw err;
    }
    return userId;
  }

  private sendError(res: Response, err: unknown) {
    const anyErr = err as any;
    const statusCode = anyErr.statusCode || (typeof anyErr.getStatusCode === "function" ? anyErr.getStatusCode() : 400);
    return res.status(statusCode).json({
      error: anyErr.message || "Request failed",
      ...(anyErr.errors ? { details: anyErr.errors } : {}),
    });
  }
}
