export const ErrConversationMemberNotFound = new Error('Conversation member not found');
export const ErrConversationMemberAlreadyExists = new Error('User is already a member');
export const ErrConversationMemberUnauthorized = new Error('Unauthorized to modify member');
export const ErrConversationMemberLastAdmin = new Error('Cannot remove the last admin');
export const ErrConversationMemberNotAdmin = new Error('User is not an admin');
export const ErrConversationMemberAlreadyLeft = new Error('User has already left the conversation');
