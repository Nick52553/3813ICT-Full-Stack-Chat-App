// Shapes of the chat data sent by the server,
// over REST and over Socket.io.

// A stored chat message (MongoDB "messages" collection).
export interface ChatMessage {
  id: number;
  channelId: number;
  groupId: number;
  userId: number;
  username: string;
  // For picture messages text is an optional caption.
  text: string;
  // e.g. /uploads/chat/<file>.png, or null for text messages
  imageUrl: string | null;
  timestamp: string;
}

// Someone currently viewing a channel.
export interface OnlineUser {
  id: number;
  username: string;
}

// "userJoined" / "userLeft" socket events.
export interface PresenceEvent {
  channelId: number;
  userId: number;
  username: string;
  timestamp: string;
}

// "onlineUsers" socket event.
export interface OnlineUsersEvent {
  channelId: number;
  users: OnlineUser[];
}

// "typing" socket event.
export interface TypingEvent {
  channelId: number;
  userId: number;
  username: string;
  isTyping: boolean;
}

// "messageDeleted" socket event.
export interface MessageDeletedEvent {
  id: number;
  channelId: number;
}

// Reply the server sends to acknowledged socket events.
export interface SocketAck {
  ok: boolean;
  message?: any;
  users?: OnlineUser[];
}

// One row in the chat window: a message, or a
// system notice such as "bobby joined".
export type ChatItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'notice'; key: string; text: string; timestamp: string };
