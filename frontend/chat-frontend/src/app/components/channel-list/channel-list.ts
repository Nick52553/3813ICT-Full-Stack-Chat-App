import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatWindow } from '../chat-window/chat-window';

@Component({
  selector: 'app-channel-list',
  standalone: true,
  imports: [CommonModule, ChatWindow],
  templateUrl: './channel-list.html',
  styleUrl: './channel-list.css'
})
export class ChannelList {
  @Input() group: any = {
    name: '',
    channels: []
  };

  channels: any[] = [];
  isGroupAdmin = false;
  activeChannelId: any = null;

  ngOnChanges() {
    this.channels = this.group?.channels ?? [];
  }

  openCreateChannel() {
    console.log('Create channel requested');
  }

  requestNewChannel() {
    console.log('Request new channel');
  }

  openChannel(channel: any) {
    this.activeChannelId = channel.id;
  }
}