import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.css'
})
export class ChatWindow {
  @Input() channelId: any = null;

  messages: any[] = [];
  newMessage = '';

  sendMessage() {
    const text = this.newMessage.trim();

    if (!text) {
      return;
    }

    this.messages.push({
      username: 'You',
      text: text
    });

    this.newMessage = '';
  }
}