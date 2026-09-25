import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';

interface ChatMessage {
  id: number;
  channelId: number;
  groupId: number;
  userId: number;
  username: string;
  text: string;
  timestamp: string;
}

const API = 'http://localhost:3000/api';

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
export class ChatWindow implements OnInit {

  groupId = '';
  channelId = '';

  groupName = '';
  channelName = '';

  // Used to decide who can delete other people's messages.
  groupAdminIds: number[] = [];

  messageText = '';

  messages: ChatMessage[] = [];

  errorMessage = '';

  sending = false;

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"username":"User","role":"user"}'
  );

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit() {

    this.groupId =
      this.route.snapshot.paramMap.get('groupId') || '';

    this.channelId =
      this.route.snapshot.paramMap.get('channelId') || '';

    this.loadNames();
    this.loadMessages();
  }

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

  loadMessages() {

    this.http.get<ChatMessage[]>(
      `${API}/channels/${this.channelId}/messages`,
      { params: { userId: this.currentUser.id } }
    ).subscribe({

      next: messages => {
        this.messages = messages;
        this.errorMessage = '';
      },

      error: error => {
        this.errorMessage =
          error.error?.message || 'Could not load messages';
      }

    });
  }

  sendMessage() {

    const text = this.messageText.trim();

    if (!text || this.sending) {
      return;
    }

    this.sending = true;

    this.http.post<ChatMessage>(
      `${API}/channels/${this.channelId}/messages`,
      {
        userId: this.currentUser.id,
        text
      }
    ).subscribe({

      next: message => {
        this.messages.push(message);
        this.messageText = '';
        this.errorMessage = '';
        this.sending = false;
      },

      error: error => {
        this.errorMessage =
          error.error?.message || 'Could not send message';
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

    this.http.delete(
      `${API}/messages/${messageId}`,
      { params: { userId: this.currentUser.id } }
    ).subscribe({

      next: () => {
        this.messages = this.messages.filter(
          m => m.id !== messageId
        );
      },

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
}
