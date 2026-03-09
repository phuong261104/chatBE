export const ErrConversationNotFound = new Error('Conversation not found');
export const ErrConversationAlreadyExists = new Error('Conversation already exists');
export const ErrConversationUnauthorized = new Error('Unauthorized to access this conversation');
export const ErrConversationInvalidType = new Error('Invalid conversation type');
export const ErrConversationNameRequired = new Error('Group conversation name is required');
export const ErrConversationNotGroup = new Error('This operation is only for group conversations');
export const ErrConversationNotPrivate = new Error('This operation is only for private conversations');
export const ErrConversationMemberNotFound = new Error('User is not a member of this conversation');
