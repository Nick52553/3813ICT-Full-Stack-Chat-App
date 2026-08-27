import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../navbar/navbar';

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

  messageText = '';

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"username":"User","role":"user"}'
  );

  messages = [
    {
      id: 1,
      username: 'Allan',
      text: 'Welcome everyone to the General channel!',
      time: '10:32 AM'
    },
    {
      id: 2,
      username: 'Nick',
      text: 'Thanks! Looking forward to chatting.',
      time: '10:34 AM'
    },
    {
      id: 3,
      username: 'Jordan',
      text: 'Has anyone played the new update yet?',
      time: '10:36 AM'
    }
  ];

  constructor(
    private route: ActivatedRoute
  ) {}

  ngOnInit() {

    this.groupId =
      this.route.snapshot.paramMap.get('groupId') || '';

    this.channelId =
      this.route.snapshot.paramMap.get('channelId') || '';

    this.setNames();
  }

  setNames() {

    if (this.groupId === 'gaming') {
      this.groupName = 'Gaming Group';
    } else if (this.groupId === 'study') {
      this.groupName = 'Study Group';
    } else {
      this.groupName = 'General Community';
    }

    if (this.channelId === 'general') {
      this.channelName = 'General';
    } else if (this.channelId === 'announcements') {
      this.channelName = 'Announcements';
    } else {
      this.channelName = 'Games';
    }
  }

  sendMessage() {

    const text = this.messageText.trim();

    if (!text) {
      return;
    }

    const newMessage = {
      id: Date.now(),
      username: this.currentUser.username,
      text: text,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    this.messages.push(newMessage);

    this.messageText = '';
  }

  deleteMessage(messageId: number) {

    const message = this.messages.find(
      m => m.id === messageId
    );

    if (!message) {
      return;
    }

    if (message.username !== this.currentUser.username) {
      return;
    }

    this.messages = this.messages.filter(
      m => m.id !== messageId
    );
  }
}