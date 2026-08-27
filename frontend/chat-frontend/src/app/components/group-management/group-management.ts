import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChannelManagement } from '../channel-management/channel-management';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-group-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChannelManagement,
    Navbar
  ],
  templateUrl: './group-management.html',
  styleUrl: './group-management.css'
})


export class GroupManagement {
  @Input() group: any = {
    name: '',
    minAge: 0,
    members: [],
    channels: []
  };

  pendingRequests: any[] = [];

  saveMetadata() {
    console.log('Group metadata saved:', this.group);
  }

  approve(request: any) {
    console.log('Approved:', request);

    this.pendingRequests =
      this.pendingRequests.filter((req) => req !== request);

    if (!this.group.members) {
      this.group.members = [];
    }

    this.group.members.push({
      username: request.username
    });
  }

  deny(request: any) {
    console.log('Denied:', request);

    this.pendingRequests =
      this.pendingRequests.filter((req) => req !== request);
  }

  banFromGroup(member: any) {
    if (!this.group.members) {
      return;
    }

    this.group.members =
      this.group.members.filter(
        (m: any) => m !== member
      );
  }

  requestSystemBan(member: any) {
    console.log('System ban requested for:', member);
  }
}