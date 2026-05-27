export const SystemMessageTemplate = {
  // Existing
  CREATE_GROUP: (actorName: string) => `${actorName} đã tạo nhóm`,
  ADD_MEMBERS: (actorName: string, targetNames: string) =>
    `${actorName} đã thêm ${targetNames} vào nhóm`,
  REMOVE_MEMBER: (actorName: string, targetName: string) =>
    `${actorName} đã xóa ${targetName} khỏi nhóm`,
  LEAVE_GROUP: (actorName: string) => `${actorName} đã rời khỏi nhóm`,

  // Group info
  RENAME_GROUP: (actorName: string, oldName: string, newName: string) =>
    `${actorName} đã đổi tên nhóm từ "${oldName}" thành "${newName}"`,
  CHANGE_AVATAR: (actorName: string) =>
    `${actorName} đã thay đổi ảnh nhóm`,

  // Member role
  SET_ADMIN: (actorName: string, targetName: string) =>
    `${actorName} đã thêm ${targetName} làm quản trị viên`,
  REMOVE_ADMIN: (actorName: string, targetName: string) =>
    `${actorName} đã xóa quyền quản trị viên của ${targetName}`,
  TRANSFER_OWNER: (actorName: string, targetName: string) =>
    `${actorName} đã chuyển quyền chủ sở hữu nhóm cho ${targetName}`,

  // Member approval
  APPROVE_MEMBER: (actorName: string, targetName: string) =>
    `${actorName} đã chấp nhận yêu cầu tham gia của ${targetName}`,
  REJECT_MEMBER: (actorName: string, targetName: string) =>
    `${actorName} đã từ chối yêu cầu tham gia của ${targetName}`,

  // Pin message
  PIN_MESSAGE: (actorName: string) =>
    `${actorName} đã ghim một tin nhắn`,
  UNPIN_MESSAGE: (actorName: string) =>
    `${actorName} đã bỏ ghim một tin nhắn`,

  // NEW - Group settings changes
  UPDATE_GROUP_SETTINGS: (actorName: string) =>
    `${actorName} đã thay đổi cài đặt nhóm`,

  // NEW - Invite link
  INVITE_LINK_CREATED: (actorName: string) =>
    `${actorName} đã tạo liên kết mời tham gia nhóm`,
  INVITE_LINK_REVOKED: (actorName: string) =>
    `${actorName} đã hủy liên kết mời tham gia nhóm`,
  INVITE_LINK_REGENERATED: (actorName: string) =>
    `${actorName} đã tạo liên kết mời mới cho nhóm`,

  // NEW - Join by invite
  MEMBER_JOINED_BY_INVITE: (memberName: string) =>
    `${memberName} đã tham gia nhóm bằng liên kết mời`,

  // NEW - Block
  MEMBER_BLOCKED: (actorName: string, targetName: string) =>
    `${actorName} đã chặn ${targetName} khỏi nhóm`,
  MEMBER_UNBLOCKED: (actorName: string, targetName: string) =>
    `${actorName} đã bỏ chặn ${targetName} khỏi nhóm`,

  // NEW - Leave with owner transfer
  OWNER_LEFT_WITH_TRANSFER: (oldOwnerName: string, newOwnerName: string) =>
    `${oldOwnerName} đã rời nhóm và chuyển quyền chủ sở hữu cho ${newOwnerName}`,
} as const;
