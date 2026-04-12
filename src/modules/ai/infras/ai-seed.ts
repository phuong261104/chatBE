// import { v7 as uuidv7 } from "uuid";
// import bcrypt from "bcrypt";
// import { DynamoMessageRepository } from "@modules/chat/infras/repository/dynamodb/message-repo";
// import { DynamoConversationRepository } from "@modules/chat/infras/repository/dynamodb/conversation-repo";
// import { DynamoConversationMemberRepository } from "@modules/chat/infras/repository/dynamodb/member-repo";
// import { DynamoUserRepository } from "@modules/user/infras/repository/dynamodb/dynamodb-repo";
// import { ConversationType, ConversationMemberRole, ConversationMemberStatus, MessageType } from "@modules/chat/model/model";
// import Logger from "@share/utils/logger";

// const TEST_USERS = [
//   {
//     id: "11111111-1111-1111-1111-111111111111",
//     phone: "0912345678",
//     email: "alice@chatbe.io",
//     displayName: "Alice",
//     password: "Test123456!",
//   },
//   {
//     id: "22222222-2222-2222-2222-222222222222",
//     phone: "0987654321",
//     email: "bob@chatbe.io",
//     displayName: "Bob",
//     password: "Test123456!",
//   },
//   {
//     id: "33333333-3333-3333-3333-333333333333",
//     phone: "0977123456",
//     email: "charlie@chatbe.io",
//     displayName: "Charlie",
//     password: "Test123456!",
//   },
// ];

// const TEST_CONVERSATIONS = [
//   {
//     id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
//     name: "Alice & Bob",
//     type: ConversationType.PRIVATE,
//     pairKey: "11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222",
//     members: [
//       { userId: "11111111-1111-1111-1111-111111111111", role: ConversationMemberRole.MEMBER, status: ConversationMemberStatus.ACTIVE },
//       { userId: "22222222-2222-2222-2222-222222222222", role: ConversationMemberRole.MEMBER, status: ConversationMemberStatus.ACTIVE },
//     ],
//     messages: [
//       { senderId: "11111111-1111-1111-1111-111111111111", text: "Chao Bob, ban khoe khong?" },
//       { senderId: "22222222-2222-2222-2222-222222222222", text: "Chao Alice! Minh khoe, cam on ban. Ban thi sao?" },
//       { senderId: "11111111-1111-1111-1111-111111111111", text: "Minh cung khoe. Tuan nay ban khong?" },
//       { senderId: "22222222-2222-2222-2222-222222222222", text: "Tuan nay minh kha ban vi phai hoan thanh du an truoc thu Sau." },
//       { senderId: "11111111-1111-1111-1111-111111111111", text: "Oi du an, minh cung dang lam du an. Ban lam gi vay?" },
//       { senderId: "22222222-2222-2222-2222-222222222222", text: "Minh dang phat trien mot ung dung chat. Rat thu vi nhung cung kha thu thach." },
//       { senderId: "11111111-1111-1111-1111-111111111111", text: "Nghe hay qua! Ban dung cong nghe gi vay?" },
//       { senderId: "22222222-2222-2222-2222-222222222222", text: "Minh dung Node.js, TypeScript, va WebSocket cho real-time messaging." },
//       { senderId: "11111111-1111-1111-1111-111111111111", text: "Cool! Minh cung dang hoc TypeScript. Co gi hay ban chia se cho minh voi nhe!" },
//       { senderId: "22222222-2222-2222-2222-222222222222", text: "Duoc chu! Cuoi tuan ranh minh se gui cho ban may tai lieu hay." },
//       { senderId: "11111111-1111-1111-1111-111111111111", text: "Cam on ban nhieu! Hen gap cuoi tuan nhe!" },
//       { senderId: "22222222-2222-2222-2222-222222222222", text: "OK, bye Alice!" },
//     ],
//   },
//   {
//     id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
//     name: "Nhom thao luan du an",
//     type: ConversationType.GROUP,
//     createdBy: "11111111-1111-1111-1111-111111111111",
//     members: [
//       { userId: "11111111-1111-1111-1111-111111111111", role: ConversationMemberRole.ADMIN, status: ConversationMemberStatus.ACTIVE },
//       { userId: "22222222-2222-2222-2222-222222222222", role: ConversationMemberRole.ADMIN, status: ConversationMemberStatus.ACTIVE },
//       { userId: "33333333-3333-3333-3333-333333333333", role: ConversationMemberRole.MEMBER, status: ConversationMemberStatus.ACTIVE },
//     ],
//     messages: [
//       { senderId: "11111111-1111-1111-1111-111111111111", text: "Chao moi nguoi, hop nhom thoi!" },
//       { senderId: "22222222-2222-2222-2222-222222222222", text: "Dong y. Minh da hoan thanh phan API." },
//       { senderId: "33333333-3333-3333-3333-333333333333", text: "Minh dang lam phan database schema, se xong vao thu Ba." },
//       { senderId: "11111111-1111-1111-1111-111111111111", text: "Tot lam! Deadline cua du an la cuoi thang nay." },
//       { senderId: "22222222-2222-2222-2222-222222222222", text: "Vay chung ta can test ky truoc tuan sau." },
//       { senderId: "33333333-3333-3333-3333-333333333333", text: "Minh se viet them unit tests cho phan cua minh." },
//       { senderId: "11111111-1111-1111-1111-111111111111", text: "Tuyet voi! Cam on moi nguoi. Chieu nay hoc tiep nhe." },
//       { senderId: "22222222-2222-2222-2222-222222222222", text: "OK, 3 gio chieu nhe!" },
//     ],
//   },
// ];

// async function seedUsers(): Promise<void> {
//   const userRepo = new DynamoUserRepository();
//   const password = "Test123456!";

//   for (const user of TEST_USERS) {
//     const existing = await userRepo.findByCond({ phone: user.phone } as any);
//     const salt = bcrypt.genSaltSync(10);
//     const hashPassword = bcrypt.hashSync(`${password}.${salt}`, 10);

//     if (!existing) {
//       await userRepo.insert({
//         id: user.id,
//         email: user.email,
//         phone: user.phone,
//         password: hashPassword,
//         salt,
//         status: "active",
//         tokenVersion: 1,
//         displayName: user.displayName,
//         verified: { email: true, phone: true },
//         privacy: { searchableByEmail: true, searchableByPhone: true, searchableByUsername: true },
//         settings: { notifications: { push: true, inApp: true } },
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       } as any);
//       Logger.info(`[AI-SEED] Created test user: ${user.phone} / ${user.email}`);
//     } else {
//       await userRepo.update(existing.id as string, { password: hashPassword, salt } as any);
//       Logger.info(`[AI-SEED] Updated test user: ${user.phone} / ${user.email}`);
//     }
//   }
// }

// async function seedConversations(): Promise<void> {
//   const convRepo = new DynamoConversationRepository();
//   const memberRepo = new DynamoConversationMemberRepository();
//   const messageRepo = new DynamoMessageRepository();

//   for (const conv of TEST_CONVERSATIONS) {
//     const existing = await convRepo.findByCond({ id: conv.id } as any);

//     if (existing) {
//       Logger.info(`[AI-SEED] Conversation already exists: ${conv.name}`);
//     } else {
//       await convRepo.insert({
//         id: conv.id,
//         type: conv.type,
//         pairKey: conv.pairKey,
//         name: conv.name,
//         createdBy: conv.createdBy,
//         membersCount: conv.members.length,
//         createdAt: new Date(),
//         updatedAt: new Date(),
//       } as any);
//       Logger.info(`[AI-SEED] Created conversation: ${conv.name}`);

//       for (const member of conv.members) {
//         await memberRepo.insert({
//           id: uuidv7(),
//           conversationId: conv.id,
//           userId: member.userId,
//           role: member.role,
//           status: member.status,
//           joinedAt: new Date(),
//           unreadCount: 0,
//           pinned: false,
//           archived: false,
//           updatedAt: new Date(),
//         } as any);
//       }
//     }

//     const baseTime = new Date();
//     const insertedMessages: Array<{ id: string; senderId: string; text: string; createdAt: Date }> = [];

//     for (let i = 0; i < conv.messages.length; i++) {
//       const msgTime = new Date(baseTime.getTime() + i * 60000);
//       const msgId = uuidv7();
//       insertedMessages.push({
//         id: msgId,
//         senderId: conv.messages[i].senderId,
//         text: conv.messages[i].text,
//         createdAt: msgTime,
//       });
//       await messageRepo.batchInsert([{
//         id: msgId,
//         conversationId: conv.id,
//         senderId: conv.messages[i].senderId,
//         type: MessageType.TEXT,
//         text: conv.messages[i].text,
//         deletedForUserIds: [],
//         pinned: false,
//         createdAt: msgTime,
//       }]);
//     }

//     if (insertedMessages.length > 0) {
//       const lastMsg = insertedMessages[insertedMessages.length - 1];
//       await convRepo.update(conv.id, {
//         lastMessage: {
//           messageId: lastMsg.id,
//           senderId: lastMsg.senderId,
//           type: MessageType.TEXT,
//           textPreview: lastMsg.text,
//           createdAt: lastMsg.createdAt,
//         },
//         lastMessageAt: lastMsg.createdAt,
//       } as any);
//     }

//     Logger.info(`[AI-SEED] Ensured ${conv.messages.length} messages for conversation: ${conv.name}`);
//   }
// }

// export async function seedAiTestData(): Promise<void> {
//   Logger.info("[AI-SEED] Starting AI test data seeding...");
//   await seedUsers();
//   await seedConversations();
//   Logger.info("[AI-SEED] AI test data seeding completed!");
//   Logger.info("[AI-SEED] Test users:");
//   Logger.info("  - alice@chatbe.io / Test123456! (userId: 11111111-...)");
//   Logger.info("  - bob@chatbe.io / Test123456! (userId: 22222222-...)");
//   Logger.info("  - charlie@chatbe.io / Test123456! (userId: 33333333-...)");
//   Logger.info("[AI-SEED] Test conversations:");
//   Logger.info("  - Alice & Bob: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa (12 messages)");
//   Logger.info("  - Nhom thao luan du an: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb (8 messages)");
// }
