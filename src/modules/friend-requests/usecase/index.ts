import { AppError } from '@share/app-error';
import { ErrDataNotFound } from '@share/model/base-error';
import { PagingDTO } from '@share/model/paging';
import { v7 } from 'uuid';
import { IFriendRequestUseCase } from '../interface';
import {
  FriendRequest,
  FriendRequestStatus,
  FriendRequestCondDTO,
  FriendRequestCreateDTO,
  FriendRequestCreateSchema,
  FriendRequestUpdateDTO,
  ErrFriendRequestAlreadyExists,
  ErrFriendRequestAlreadyFriends,
  ErrFriendRequestNotFound,
  ErrFriendRequestSelfRequest,
  ErrFriendRequestUnauthorized,
  ErrFriendRequestUserBlocked
} from '../model';
import {
  ConversationType,
  ConversationMemberRole,
  ConversationMemberStatus,
  MessageType,
} from '@modules/chat/model/model';

interface ConversationCommandRepo {
  insert(conversation: any): Promise<boolean>;
  update(id: string, data: any): Promise<boolean>;
}

interface ConversationMemberCommandRepo {
  insert(member: any): Promise<boolean>;
}

interface MessageCommandRepo {
  insert(message: any): Promise<boolean>;
}

export class FriendRequestUseCase implements IFriendRequestUseCase {
  constructor(
    private readonly repository: any,
    private readonly blockRepository: any,
    private readonly friendshipRepository: any,
    private readonly userRepository: any,
    private readonly conversationCommandRepo: ConversationCommandRepo,
    private readonly conversationMemberCommandRepo: ConversationMemberCommandRepo,
    private readonly messageCommandRepo: MessageCommandRepo,
  ) {}

  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<string> {
    if (fromUserId === toUserId) {
      throw AppError.from(ErrFriendRequestSelfRequest, 400);
    }

    const toUser = await this.userRepository.get(toUserId);
    if (!toUser) {
      throw AppError.from(new Error('Target user does not exist'), 404);
    }

    const blockExists = await this.blockRepository.findByCond({
      blockerId: fromUserId,
      blockedUserId: toUserId
    });

    const reverseBlockExists = await this.blockRepository.findByCond({
      blockerId: toUserId,
      blockedUserId: fromUserId
    });

    if (blockExists || reverseBlockExists) {
      throw AppError.from(ErrFriendRequestUserBlocked, 400);
    }

    const [userA, userB] = [fromUserId, toUserId].sort();
    const friendship = await this.friendshipRepository.findByCond({
      userA,
      userB
    });

    if (friendship) {
      throw AppError.from(ErrFriendRequestAlreadyFriends, 400);
    }

    const existingRequest = await this.repository.findByCond({
      fromUserId,
      toUserId,
      status: FriendRequestStatus.PENDING
    });

    if (existingRequest) {
      throw AppError.from(ErrFriendRequestAlreadyExists, 400);
    }

    const reverseRequest = await this.repository.findByCond({
      fromUserId: toUserId,
      toUserId: fromUserId,
      status: FriendRequestStatus.PENDING
    });

    if (reverseRequest) {
      throw AppError.from(ErrFriendRequestAlreadyExists, 400).withLog('Reverse request exists');
    }

    const newId = v7();
    const newRequest: FriendRequest = {
      id: newId,
      fromUserId,
      toUserId,
      status: FriendRequestStatus.PENDING,
      createdAt: new Date()
    };

    await this.repository.insert(newRequest);

    return newId;
  }

  async acceptFriendRequest(requestId: string, userId: string): Promise<boolean> {
    const request = await this.repository.get(requestId);
    if (!request) {
      throw AppError.from(ErrFriendRequestNotFound, 404);
    }

    if (request.toUserId !== userId) {
      throw AppError.from(ErrFriendRequestUnauthorized, 403);
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw AppError.from(new Error('Friend request is not pending'), 400);
    }

    const blockExists = await this.blockRepository.findByCond({
      blockerId: request.fromUserId,
      blockedUserId: request.toUserId
    });

    const reverseBlockExists = await this.blockRepository.findByCond({
      blockerId: request.toUserId,
      blockedUserId: request.fromUserId
    });

    if (blockExists || reverseBlockExists) {
      throw AppError.from(ErrFriendRequestUserBlocked, 400);
    }

    const [userA, userB] = [request.fromUserId, request.toUserId].sort();
    const existingFriendship = await this.friendshipRepository.findByCond({
      userA,
      userB
    });

    if (existingFriendship) {
      throw AppError.from(ErrFriendRequestAlreadyFriends, 400);
    }

    await this.repository.update(requestId, {
      status: FriendRequestStatus.ACCEPTED,
      respondedAt: new Date()
    });

    const friendshipId = v7();

    await this.friendshipRepository.insert({
      id: friendshipId,
      userA,
      userB,
      createdAt: new Date()
    });

    await this.createConversationForFriendship(userA, userB);

    return true;
  }

  private async createConversationForFriendship(userA: string, userB: string): Promise<void> {
    const conversationId = v7();
    const now = new Date();

    const conversation = {
      id: conversationId,
      type: ConversationType.PRIVATE,
      pairKey: [userA, userB].sort().join('_'),
      membersCount: 2,
      createdAt: now,
      updatedAt: now,
    };
    await this.conversationCommandRepo.insert(conversation);

    const member1 = {
      id: v7(),
      conversationId: conversationId,
      userId: userA,
      role: ConversationMemberRole.MEMBER,
      status: ConversationMemberStatus.ACTIVE,
      joinedAt: now,
      unreadCount: 0,
      pinned: false,
      archived: false,
      updatedAt: now,
    };
    await this.conversationMemberCommandRepo.insert(member1);

    const member2 = {
      id: v7(),
      conversationId: conversationId,
      userId: userB,
      role: ConversationMemberRole.MEMBER,
      status: ConversationMemberStatus.ACTIVE,
      joinedAt: now,
      unreadCount: 0,
      pinned: false,
      archived: false,
      updatedAt: now,
    };
    await this.conversationMemberCommandRepo.insert(member2);

    const messageId = v7();
    const systemMessageText = 'Hai bạn đã trở thành bạn bè';
    const systemMessage = {
      id: messageId,
      conversationId: conversationId,
      senderId: userA,
      type: MessageType.SYSTEM,
      text: systemMessageText,
      createdAt: now,
      pinned: false,
    };
    await this.messageCommandRepo.insert(systemMessage);

    await this.conversationCommandRepo.update(conversationId, {
      lastMessage: {
        messageId: messageId,
        senderId: userA,
        type: MessageType.SYSTEM,
        textPreview: systemMessageText,
        createdAt: now,
      },
      lastMessageAt: now,
    });
  }

  async rejectFriendRequest(requestId: string, userId: string): Promise<boolean> {
    const request = await this.repository.get(requestId);
    if (!request) {
      throw AppError.from(ErrFriendRequestNotFound, 404);
    }

    if (request.toUserId !== userId) {
      throw AppError.from(ErrFriendRequestUnauthorized, 403);
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw AppError.from(new Error('Friend request is not pending'), 400);
    }

    // 4. Update request status
    await this.repository.update(requestId, {
      status: FriendRequestStatus.REJECTED,
      respondedAt: new Date()
    });

    return true;
  }

  async cancelFriendRequest(requestId: string, userId: string): Promise<boolean> {
    const request = await this.repository.get(requestId);
    if (!request) {
      throw AppError.from(ErrFriendRequestNotFound, 404);
    }

    if (request.fromUserId !== userId) {
      throw AppError.from(ErrFriendRequestUnauthorized, 403);
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw AppError.from(new Error('Friend request is not pending'), 400);
    }

    await this.repository.update(requestId, {
      status: FriendRequestStatus.CANCELED,
      respondedAt: new Date()
    });

    return true;
  }

  async getReceivedRequests(userId: string): Promise<FriendRequest[]> {
    return await this.repository.list(
      {
        toUserId: userId,
        status: FriendRequestStatus.PENDING
      },
      { page: 1, limit: 100 }
    );
  }

  async getSentRequests(userId: string): Promise<FriendRequest[]> {
    return await this.repository.list(
      {
        fromUserId: userId,
        status: FriendRequestStatus.PENDING
      },
      { page: 1, limit: 100 }
    );
  }

  async checkFriendRequestStatus(
    currentUserId: string,
    targetUserId: string,
  ): Promise<{ status: string; requestId?: string; direction?: string }> {
    if (currentUserId === targetUserId) {
      return { status: "SELF" };
    }

    const [userA, userB] = [currentUserId, targetUserId].sort();
    const friendship = await this.friendshipRepository.findByCond({ userA, userB });
    if (friendship) {
      return { status: "ACCEPTED" };
    }

    const outgoing = await this.repository.findByCond({
      fromUserId: currentUserId,
      toUserId: targetUserId,
      status: FriendRequestStatus.PENDING,
    });
    if (outgoing) {
      return { status: "PENDING", requestId: outgoing.id, direction: "OUTGOING" };
    }

    const incoming = await this.repository.findByCond({
      fromUserId: targetUserId,
      toUserId: currentUserId,
      status: FriendRequestStatus.PENDING,
    });
    if (incoming) {
      return { status: "PENDING", requestId: incoming.id, direction: "INCOMING" };
    }

    const outgoingRejected = await this.repository.findByCond({
      fromUserId: currentUserId,
      toUserId: targetUserId,
      status: FriendRequestStatus.REJECTED,
    });
    if (outgoingRejected) {
      return { status: "REJECTED", requestId: outgoingRejected.id, direction: "OUTGOING" };
    }

    const incomingRejected = await this.repository.findByCond({
      fromUserId: targetUserId,
      toUserId: currentUserId,
      status: FriendRequestStatus.REJECTED,
    });
    if (incomingRejected) {
      return { status: "REJECTED", requestId: incomingRejected.id, direction: "INCOMING" };
    }

    return { status: "NONE" };
  }

  async create(data: FriendRequestCreateDTO): Promise<string> {
    const dto = FriendRequestCreateSchema.parse(data);
    return await this.sendFriendRequest(dto.fromUserId, dto.toUserId);
  }

  async getDetail(id: string): Promise<FriendRequest | null> {
    const data = await this.repository.get(id);
    if (!data) {
      throw ErrDataNotFound;
    }
    return data;
  }

  async update(id: string, data: FriendRequestUpdateDTO): Promise<boolean> {
    await this.repository.update(id, data);
    return true;
  }

  async list(cond: FriendRequestCondDTO, paging: PagingDTO): Promise<FriendRequest[]> {
    return await this.repository.list(cond, paging);
  }

  async delete(id: string): Promise<boolean> {
    await this.repository.delete(id, true);
    return true;
  }
}
