import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navbar } from '../navbar/navbar';
import { ChannelList } from '../channel-list/channel-list';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Navbar,
    ChannelList
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {
  myGroups: any[] = [];

  selectedGroup: any = null;

  pendingRequestCount = 0;

  currentUser: any = {
    username: 'User',
    role: 'user',
    online: true
  };

  selectGroup(group: any) {
    this.selectedGroup = group;
  }
}