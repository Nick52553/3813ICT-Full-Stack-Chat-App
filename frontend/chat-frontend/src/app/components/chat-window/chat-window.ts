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

  messages = [
    {
      username: 'Allan',
      text: 'Welcome everyone to the General channel!',
      time: '10:32 AM'
    },
    {
      username: 'Nick',
      text: 'Thanks! Looking forward to chatting.',
      time: '10:34 AM'
    },
    {
      username: 'Jordan',
      text: 'Has anyone played the new update yet?',
      time: '10:36 AM'
    }
  ];

  constructor(private route: ActivatedRoute) {}

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

    const currentUser = JSON.parse(
      localStorage.getItem('currentUser') ||
      '{"username":"User"}'
    );

    this.messages.push({
      username: currentUser.username,
      text: text,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    });

    this.messageText = '';
  }
}