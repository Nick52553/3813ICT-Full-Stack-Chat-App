import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-channel-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Navbar
  ],
  templateUrl: './channel-management.html',
  styleUrl: './channel-management.css'
})
export class ChannelManagement implements OnInit {

  groups: any[] = [];
  users: any[] = [];
  channels: any[] = [];

  groupId: number | null = null;
  channelId: number | null = null;
  userId: number | null = null;

  channelName = '';
  description = '';

  message = '';
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadGroups();
    this.loadUsers();
    this.loadChannels();
  }

  loadGroups() {
    this.http.get<any[]>(
      'http://localhost:3000/api/groups'
    ).subscribe({
      next: groups => this.groups = groups
    });
  }

  loadUsers() {
    this.http.get<any[]>(
      'http://localhost:3000/api/users'
    ).subscribe({
      next: users => this.users = users
    });
  }

  loadChannels() {
    this.http.get<any[]>(
      'http://localhost:3000/api/channels'
    ).subscribe({
      next: channels => this.channels = channels
    });
  }

  createChannel() {

    this.message = '';
    this.error = '';

    this.http.post<any>(
      'http://localhost:3000/api/channels',
      {
        groupId: this.groupId,
        name: this.channelName,
        description: this.description,
        memberIds: []
      }
    ).subscribe({

      next: channel => {

        this.message =
          `${channel.name} was created successfully.`;

        this.channelName = '';
        this.description = '';

        this.loadChannels();
      },

      error: error => {

        this.error =
          error.error?.message ||
          'Could not create channel.';
      }

    });
  }

  assignUser() {

    if (!this.channelId || !this.userId) {
      return;
    }

    this.http.post<any>(
      `http://localhost:3000/api/channels/${this.channelId}/members`,
      {
        userId: this.userId
      }
    ).subscribe({

      next: () => {
        this.message = 'User assigned to channel.';
        this.loadChannels();
      },

      error: error => {
        this.error =
          error.error?.message ||
          'Could not assign user.';
      }

    });
  }
}