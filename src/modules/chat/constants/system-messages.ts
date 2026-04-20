export const SystemMessageTemplate = {
  // Existing
  CREATE_GROUP: (actorName: string) => `${actorName} đã tạo nhóm`,
  ADD_MEMBERS: (actorName: string, targetNames: string) =>
    `${actorName} đã thêm ${targetNames} vào nhóm`,
  REMOVE_MEMBER: (actorName: string, targetName: string) =>
    `${actorName} đã xóa ${targetName} khỏi nhóm`,
  LEAVE_GROUP: (actorName: string) => `${actorName} đã rời khỏi nhóm`,

  // NEW - Group info
  RENAME_GROUP: (actorName: string, oldName: string, newName: string) =>
    `${actorName} đã đổi tên nhóm từ "${oldName}" thành "${newName}"`,
  CHANGE_AVATAR: (actorName: string) =>
    `${actorName} đã thay đổi ảnh nhóm`,

  // NEW - Member role
  SET_ADMIN: (actorName: string, targetName: string) =>
    `${actorName} đã thêm ${targetName} làm quản trị viên`,
  REMOVE_ADMIN: (actorName: string, targetName: string) =>
    `${actorName} đã xóa quyền quản trị viên của ${targetName}`,
  TRANSFER_OWNER: (actorName: string, targetName: string) =>
    `${actorName} đã chuyển quyền chủ sở hữu nhóm cho ${targetName}`,

  // NEW - Member approval
  APPROVE_MEMBER: (actorName: string, targetName: string) =>
    `${actorName} đã chấp nhận yêu cầu tham gia của ${targetName}`,
  REJECT_MEMBER: (actorName: string, targetName: string) =>
    `${actorName} đã từ chối yêu cầu tham gia của ${targetName}`,

  // NEW - Pin message
  PIN_MESSAGE: (actorName: string) =>
    `${actorName} đã ghim một tin nhắn`,
  UNPIN_MESSAGE: (actorName: string) =>
    `${actorName} đã bỏ ghim một tin nhắn`,
} as const;
