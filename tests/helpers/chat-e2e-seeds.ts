import {
  ConversationMemberRole,
  ConversationType,
} from "@modules/chat/model";
import { bearer } from "./chat-e2e-socket";
import { ChatE2EStore, isDefined } from "./chat-e2e-store";

export function seedPrivateConversation(
  store: ChatE2EStore,
  userA = store.addUser({ displayName: "Alice" }),
  userB = store.addUser({ displayName: "Bob" }),
) {
  store.addFriendship(userA.id, userB.id);
  const conversation = store.addConversation({
    type: ConversationType.PRIVATE,
    pairKey: [userA.id, userB.id].sort().join("_"),
    membersCount: 2,
  });
  store.addMember({ conversationId: conversation.id, userId: userA.id });
  store.addMember({ conversationId: conversation.id, userId: userB.id });
  return { userA, userB, conversation };
}

export function seedGroupConversation(store: ChatE2EStore, memberCount = 3) {
  const users = Array.from({ length: memberCount }, (_, index) =>
    store.addUser({ displayName: ["Owner", "Admin", "Member", "Extra"][index] || `User ${index + 1}` }),
  );
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      store.addFriendship(users[i].id, users[j].id);
    }
  }
  const conversation = store.addConversation({
    type: ConversationType.GROUP,
    name: "Team",
    createdBy: users[0].id,
    ownerId: users[0].id,
    admins: [users[1]?.id].filter(isDefined),
    membersCount: users.length,
  });
  users.forEach((user, index) => {
    store.addMember({
      conversationId: conversation.id,
      userId: user.id,
      role:
        index === 0
          ? ConversationMemberRole.OWNER
          : index === 1
            ? ConversationMemberRole.ADMIN
            : ConversationMemberRole.MEMBER,
      joinedAt: new Date(Date.UTC(2026, 0, index + 1)),
    });
  });
  return {
    owner: users[0],
    admin: users[1],
    member: users[2],
    users,
    conversation,
  };
}

export function authHeader(userId: string) {
  return { Authorization: bearer(userId) };
}
