import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-channel-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './channel-management.html',
  styleUrl: './channel-management.css'
})
export class ChannelManagement {
  @Input() group: any = {
    channels: []
  };

  newChannelName = '';
  pendingChannelRequests: any[] = [];

  createChannel() {
    if (!this.newChannelName.trim()) {
      return;
    }

    if (!this.group.channels) {
      this.group.channels = [];
    }

    this.group.channels.push({
      id: Date.now(),
      name: this.newChannelName.trim()
    });

    this.newChannelName = '';
  }

  removeChannel(channel: any) {
    if (!this.group.channels) {
      return;
    }

    this.group.channels = this.group.channels.filter(
      (c: any) => c.id !== channel.id
    );
  }

  approveChannelRequest(req: any) {
    console.log('Approved channel request:', req);
    this.pendingChannelRequests =
      this.pendingChannelRequests.filter((r) => r !== req);
  }

  denyChannelRequest(req: any) {
    console.log('Denied channel request:', req);
    this.pendingChannelRequests =
      this.pendingChannelRequests.filter((r) => r !== req);
  }
}