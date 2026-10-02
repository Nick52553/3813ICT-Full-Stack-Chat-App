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
import {
  IMAGE_ACCEPT,
  SERVER_URL,
  imageSrc,
  validateImageFile
} from '../../utils/images';

const API = `${SERVER_URL}/api`;

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

  // userId -> avatar path, for the pictures beside messages
  private avatars = new Map<number, string>();

  // A getter rather than a copied field, so the shared
  // constant is read when the template renders.
  get imageAccept() { return IMAGE_ACCEPT; }

  // Image picked with the 📎 button, waiting to be sent
  selectedImage: File | null = null;
  selectedImagePreview: string | null = null;

  // username -> timer that hides their typing indicator
  private typingUsers = new Map<string, ReturnType<typeof setTimeout>>();

  private isTyping = false;
  private typingIdleTimer: ReturnType<typeof setTimeout> | null = null;

  private subscriptions = new Subscription();

  errorMessage = '';

  sending = false;

  // True once the server has confirmed we're in the channel.
  // Sending is blocked until then.
  joined = false;

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
    this.loadAvatars();
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

    this.clearSelectedImage();
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

  loadAvatars() {

    this.http.get<any[]>(`${API}/users`).subscribe({
      next: users => {
        for (const user of users) {
          if (user.avatarUrl) {
            this.avatars.set(user.id, user.avatarUrl);
          }
        }
      }
    });
  }

  // Full URL of a sender's profile picture, or null to
  // fall back to their initial.
  avatarFor(userId: number): string | null {
    return imageSrc(this.avatars.get(userId));
  }

  imageSrc(url: string | null): string | null {
    return imageSrc(url);
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
    this.joined = true;
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

    if (this.sending || !this.joined) {
      return;
    }

    if (this.selectedImage) {
      this.sendImage(text);
      return;
    }

    if (!text) {
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
    this.clearComposerIfUnchanged(text);
    this.errorMessage = '';
  }

  // ------------------------------------------------
  // IMAGES
  // ------------------------------------------------

  // Called when a file is picked with the 📎 button.
  onImageSelected(event: Event) {

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // Reset so picking the same file again still fires.
    input.value = '';

    if (!file) {
      return;
    }

    const problem = validateImageFile(file);

    if (problem) {
      this.errorMessage = problem;
      return;
    }

    this.clearSelectedImage();
    this.errorMessage = '';
    this.selectedImage = file;
    this.selectedImagePreview = URL.createObjectURL(file);
  }

  clearSelectedImage() {

    // Free the memory held by the preview.
    if (this.selectedImagePreview) {
      URL.revokeObjectURL(this.selectedImagePreview);
    }

    this.selectedImage = null;
    this.selectedImagePreview = null;
  }

  // Empty the message box after a send - but only if it still
  // holds what was sent. If the user has started typing the
  // next message while waiting for the server, keep that.
  private clearComposerIfUnchanged(sentText: string) {
    if (this.messageText.trim() === sentText) {
      this.messageText = '';
    }
  }

  // Upload over HTTP; the server then broadcasts the
  // new message to the channel over the socket.
  private sendImage(caption: string) {

    const file = this.selectedImage!;

    const form = new FormData();
    form.append('image', file);
    form.append('userId', String(this.currentUser.id));
    form.append('text', caption);

    this.sending = true;
    this.stopTyping();

    this.http.post<ChatMessage>(
      `${API}/channels/${this.channelId}/images`,
      form
    ).subscribe({

      next: message => {
        this.addMessage(message);

        // Unless another image was picked during the upload.
        if (this.selectedImage === file) {
          this.clearSelectedImage();
        }

        this.clearComposerIfUnchanged(caption);
        this.errorMessage = '';
        this.sending = false;
      },

      error: error => {
        this.errorMessage =
          error.error?.message || 'Could not send the image';
        this.sending = false;
      }

    });
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
