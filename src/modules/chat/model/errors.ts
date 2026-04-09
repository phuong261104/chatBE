export const ErrConversationNotFound = new Error('Conversation not found');
export const ErrConversationAlreadyExists = new Error('Conversation already exists');
export const ErrConversationUnauthorized = new Error('Unauthorized to access this conversation');
export const ErrInvalidConversationType = new Error('Invalid conversation type');
export const ErrConversationInvalidType = new Error('Invalid conversation type');
export const ErrConversationNameRequired = new Error('Group conversation name is required');
export const ErrConversationNotGroup = new Error('This operation is only for group conversations');
export const ErrConversationNotPrivate = new Error('This operation is only for private conversations');
export const ErrOnlyGroupCanHaveMembers = new Error('Only group conversations can add members');
export const ErrOnlyGroupCanBeUpdated = new Error('Only group conversations can be updated');

export const ErrConversationMemberNotFound = new Error('Conversation member not found');
export const ErrConversationMemberAlreadyExists = new Error('User is already a member');
export const ErrConversationMemberUnauthorized = new Error('Unauthorized to modify member');
export const ErrConversationMemberLastAdmin = new Error('Cannot remove the last admin');
export const ErrConversationMemberNotAdmin = new Error('User is not an admin');
export const ErrConversationMemberAlreadyLeft = new Error('User has already left the conversation');
export const ErrNotMember = new Error('You are not a member of this conversation');
export const ErrNotAdmin = new Error('Only admins can perform this action');
export const ErrTargetNotMember = new Error('Target user is not a member');
export const ErrMemberAlreadyExists = new Error('Member already exists in this conversation');
export const ErrGroupMustHaveMembers = new Error('Group must have at least 2 members');

export const ErrMessageNotFound = new Error('Message not found');
export const ErrMessageUnauthorized = new Error('Unauthorized to modify this message');
export const ErrMessageAlreadyDeleted = new Error('Message is already deleted');
export const ErrInvalidMessageType = new Error('Invalid message type');
export const ErrMessageInvalidType = new Error('Invalid message type');
export const ErrMessageTextRequired = new Error('Text is required for text messages');
export const ErrMessageMediaRequired = new Error('Media is required for image/file messages');
export const ErrMessageEditTimeout = new Error('Message edit timeout exceeded');
export const ErrMessageConversationNotFound = new Error('Conversation not found');
export const ErrMessageTooLong = new Error('Message is too long');

export const ErrUserNotFound = new Error('User not found');
export const ErrUserNotActive = new Error('User is not active');
export const ErrInvalidUsersList = new Error('One or more users are invalid or inactive');

export const ErrUnauthorized = new Error('Unauthorized');
export const ErrOnlyAdminsCanAddMembers = new Error('Only admins can add members');
export const ErrOnlyAdminsCanRemoveMembers = new Error('Only admins can remove other members');
export const ErrOnlyAdminsCanUpdateGroup = new Error('Only admins can update group info');

export const ErrInvalidUserId = new Error('Invalid user ID');
export const ErrInvalidConversationId = new Error('Invalid conversation ID');
export const ErrInvalidMemberIds = new Error('Invalid member IDs');
export const ErrGroupNameRequired = new Error('Group name is required');
export const ErrGroupNameTooLong = new Error('Group name is too long');

export const ErrConversationAlreadyMuted = new Error('Conversation is already muted');
export const ErrConversationNotMuted = new Error('Conversation is not muted');
export const ErrConversationAlreadyPinned = new Error('Conversation is already pinned');
export const ErrConversationNotPinned = new Error('Conversation is not pinned');
export const ErrConversationAlreadyArchived = new Error('Conversation is already archived');
export const ErrConversationNotArchived = new Error('Conversation is not archived');
export const ErrMessageCannotEdit = new Error('Only text messages can be edited');
export const ErrMessageEditTimeExpired = new Error('Message edit time limit exceeded (15 minutes)');
export const ErrMessageAlreadyPinned = new Error('Message is already pinned');
export const ErrMessageNotPinned = new Error('Message is not pinned');
export const ErrMessageRecallTimeExpired = new Error('Message can only be recalled within 1 day');
