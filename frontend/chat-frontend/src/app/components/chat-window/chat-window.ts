import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { Navbar } from '../navbar/navbar';
import { SocketService } from '../../services/socket.service';
import {
  ChatItem,
  ChatMessage,
  MessageDeletedEvent,
  OnlineUser,
  OnlineUsersEvent,
  PresenceEvent,
  TypingEvent
} from '../../models/chat.models';

const API = 'http://localhost:3000/api';

// Stop showing "X is typing" if we never hear that they
// stopped (e.g. they closed the tab mid-sentence).
const TYPING_DISPLAY_MS = 4000;

// Tell others we stopped typing after this long idle.
const TYPING_IDLE_MS = 2000;

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    Navbar
  ],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.css'
})
export class ChatWindow implements OnInit, OnDestroy {

  groupId = '';
  channelId = '';

  groupName = '';
  channelName = '';

  // Used to decide who can delete other people's messages.
  groupAdminIds: number[] = [];

  messageText = '';

  // Messages and join/leave notices, oldest first.
  timeline: ChatItem[] = [];

  onlineUsers: OnlineUser[] = [];

  // username -> timer that hides their typing indicator
  private typingUsers = new Map<string, ReturnType<typeof setTimeout>>();

  private isTyping = false;
  private typingIdleTimer: ReturnType<typeof setTimeout> | null = null;

  private subscriptions = new Subscription();

  errorMessage = '';

  sending = false;

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"username":"User","role":"user"}'
  );

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    public socket: SocketService
  ) {}

  ngOnInit() {

    this.groupId =
      this.route.snapshot.paramMap.get('groupId') || '';

    this.channelId =
      this.route.snapshot.paramMap.get('channelId') || '';

    this.loadNames();
    this.listenForEvents();

    // Join first, then load history, so no message can
    // slip through the gap between the two.
    this.joinChannel().then(() => this.loadMessages());
  }

  ngOnDestroy() {

    this.stopTyping();

    this.socket.leaveChannel(Number(this.channelId));

    this.subscriptions.unsubscribe();

    this.typingUsers.forEach(timer => clearTimeout(timer));
  }

  // ------------------------------------------------
  // LOADING
  // ------------------------------------------------

  loadNames() {

    this.http.get<any>(
      `${API}/groups/${this.groupId}`
    ).subscribe({
      next: group => {
        this.groupName = group.name;
        this.groupAdminIds = group.adminIds || [];
      }
    });

    this.http.get<any[]>(
      `${API}/groups/${this.groupId}/channels`
    ).subscribe({
      next: channels => {
        const channel = channels.find(
          c => c.id === Number(this.channelId)
        );
        this.channelName = channel ? channel.name : '';
      }
    });
  }

  async joinChannel() {

    const ack = await this.socket.joinChannel(
      this.currentUser.id,
      Number(this.channelId)
    );

    if (!ack.ok) {
      this.errorMessage = ack.message || 'Could not join the channel';
      return;
    }

    this.onlineUsers = ack.users || [];
  }

  loadMessages() {

    this.http.get<ChatMessage[]>(
      `${API}/channels/${this.channelId}/messages`,
      { params: { userId: this.currentUser.id } }
    ).subscribe({

      next: history => {

        // Keep anything that arrived live while the
        // history was loading.
        const historyIds = new Set(history.map(m => m.id));

        const live = this.timeline.filter(item =>
          item.kind === 'notice' || !historyIds.has(item.message.id)
        );

        this.timeline = [
          ...history.map(message => ({ kind: 'message' as const, message })),
          ...live
        ];
      },

      error: error => {
        this.errorMessage =
          error.error?.message || 'Could not load messages';
      }

    });
  }

  // ------------------------------------------------
  // REAL-TIME EVENTS
  // ------------------------------------------------

  listenForEvents() {

    const channelId = () => Number(this.channelId);

    this.subscriptions.add(
      this.socket.on<ChatMessage>('newMessage').subscribe(message => {
        if (message.channelId === channelId()) {
          this.addMessage(message);
          this.clearTyping(message.username);
        }
      })
    );

    this.subscriptions.add(
      this.socket.on<MessageDeletedEvent>('messageDeleted').subscribe(event => {
        if (event.channelId === channelId()) {
          this.removeMessage(event.id);
        }
      })
    );

    this.subscriptions.add(
      this.socket.on<PresenceEvent>('userJoined').subscribe(event => {
        if (event.channelId === channelId()) {
          this.addNotice(`${event.username} joined the channel`, event.timestamp);
        }
      })
    );

    this.subscriptions.add(
      this.socket.on<PresenceEvent>('userLeft').subscribe(event => {
        if (event.channelId === channelId()) {
          this.addNotice(`${event.username} left the channel`, event.timestamp);
          this.clearTyping(event.username);
        }
      })
    );

    this.subscriptions.add(
      this.socket.on<OnlineUsersEvent>('onlineUsers').subscribe(event => {
        if (event.channelId === channelId()) {
          this.onlineUsers = event.users;
        }
      })
    );

    this.subscriptions.add(
      this.socket.on<TypingEvent>('typing').subscribe(event => {
        if (event.channelId !== channelId()) {
          return;
        }
        if (event.isTyping) {
          this.showTyping(event.username);
        } else {
          this.clearTyping(event.username);
        }
      })
    );
  }

  private addMessage(message: ChatMessage) {

    const exists = this.timeline.some(
      item => item.kind === 'message' && item.message.id === message.id
    );

    if (!exists) {
      this.timeline = [...this.timeline, { kind: 'message', message }];
    }
  }

  private removeMessage(messageId: number) {
    this.timeline = this.timeline.filter(
      item => item.kind !== 'message' || item.message.id !== messageId
    );
  }

  private addNotice(text: string, timestamp: string) {
    this.timeline = [
      ...this.timeline,
      { kind: 'notice', key: `${timestamp}-${text}`, text, timestamp }
    ];
  }

  // ------------------------------------------------
  // TYPING INDICATOR
  // ------------------------------------------------

  private showTyping(username: string) {

    clearTimeout(this.typingUsers.get(username));

    this.typingUsers.set(
      username,
      setTimeout(() => this.clearTyping(username), TYPING_DISPLAY_MS)
    );
  }

  private clearTyping(username: string) {
    clearTimeout(this.typingUsers.get(username));
    this.typingUsers.delete(username);
  }

  // e.g. "bobby is typing…" / "bobby and ben are typing…"
  get typingText(): string {

    const names = [...this.typingUsers.keys()];

    if (names.length === 0) {
      return '';
    }

    if (names.length === 1) {
      return `${names[0]} is typing…`;
    }

    if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing…`;
    }

    return 'Several people are typing…';
  }

  // Called on every keystroke in the message box.
  onTyping() {

    if (!this.isTyping) {
      this.isTyping = true;
      this.socket.sendTyping(Number(this.channelId), true);
    }

    if (this.typingIdleTimer) {
      clearTimeout(this.typingIdleTimer);
    }

    this.typingIdleTimer = setTimeout(
      () => this.stopTyping(),
      TYPING_IDLE_MS
    );
  }

  private stopTyping() {

    if (this.typingIdleTimer) {
      clearTimeout(this.typingIdleTimer);
      this.typingIdleTimer = null;
    }

    if (this.isTyping) {
      this.isTyping = false;
      this.socket.sendTyping(Number(this.channelId), false);
    }
  }

  // ------------------------------------------------
  // SENDING / DELETING
  // ------------------------------------------------

  async sendMessage() {

    const text = this.messageText.trim();

    if (!text || this.sending) {
      return;
    }

    this.sending = true;
    this.stopTyping();

    const ack = await this.socket.sendMessage(
      Number(this.channelId),
      text
    );

    this.sending = false;

    if (!ack.ok) {
      this.errorMessage = ack.message || 'Could not send message';
      return;
    }

    // The broadcast usually arrives first; this covers
    // the case where it doesn't.
    this.addMessage(ack.message);
    this.messageText = '';
    this.errorMessage = '';
  }

  // Mirrors the server's rule: the sender, an admin
  // of this group, or the Super Admin.
  canDelete(message: ChatMessage): boolean {
    return message.userId === this.currentUser.id ||
      this.currentUser.role === 'superAdmin' ||
      this.groupAdminIds.includes(this.currentUser.id);
  }

  deleteMessage(messageId: number) {

    // The server broadcasts "messageDeleted", which
    // removes it for everyone else.
    this.http.delete(
      `${API}/messages/${messageId}`,
      { params: { userId: this.currentUser.id } }
    ).subscribe({

      next: () => this.removeMessage(messageId),

      error: error => {
        this.errorMessage =
          error.error?.message || 'Could not delete message';
      }

    });
  }

  formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Lets *ngFor keep existing rows when the list changes.
  trackItem(_index: number, item: ChatItem): string {
    return item.kind === 'message'
      ? `m${item.message.id}`
      : `n${item.key}`;
  }
}
