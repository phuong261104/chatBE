export const ErrFriendRequestNotFound = new Error('Friend request not found');
export const ErrFriendRequestAlreadyExists = new Error('Friend request already exists');
export const ErrFriendRequestAlreadyFriends = new Error('Users are already friends');
export const ErrFriendRequestSelfRequest = new Error('Cannot send friend request to yourself');
export const ErrFriendRequestUnauthorized = new Error('Unauthorized to modify this friend request');
export const ErrFriendRequestInvalidStatus = new Error('Invalid friend request status');
export const ErrFriendRequestUserBlocked = new Error('Cannot send friend request to blocked user');
export const ErrFriendRequestUserNotFound = new Error('Target user does not exist');
