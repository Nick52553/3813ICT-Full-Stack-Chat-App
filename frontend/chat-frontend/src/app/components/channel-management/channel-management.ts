import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';
import {
  LIMITS,
  hasErrors,
  httpErrorMessage,
  validateDescription,
  validateName,
  validateRequired
} from '../../utils/validation';

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

  readonly limits = LIMITS;

  // Set once Create Channel is pressed, so field errors
  // don't show before anything has been typed.
  submitted = false;

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

  // One entry per field: an error message, or null.
  get errors() {
    return {
      groupId: validateRequired(this.groupId, 'Please choose a group'),
      channelName: validateName(this.channelName, 'Channel name'),
      description: validateDescription(this.description)
    };
  }

  createChannel() {

    this.message = '';
    this.error = '';
    this.submitted = true;

    if (hasErrors(this.errors)) {
      return;
    }

    this.http.post<any>(
      'http://localhost:3000/api/channels',
      {
        groupId: this.groupId,
        name: this.channelName.trim(),
        description: this.description.trim(),
        memberIds: []
      }
    ).subscribe({

      next: channel => {

        this.message =
          `${channel.name} was created successfully.`;

        this.channelName = '';
        this.description = '';
        this.submitted = false;

        this.loadChannels();
      },

      error: error => {

        this.error =
          httpErrorMessage(error, 'Could not create channel.');
      }

    });
  }

  assignUser() {

    this.message = '';
    this.error = '';

    if (!this.channelId || !this.userId) {
      this.error = 'Please select both a channel and a user.';
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
          httpErrorMessage(error, 'Could not assign user.');
      }

    });
  }
}