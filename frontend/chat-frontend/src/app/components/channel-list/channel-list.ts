import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-channel-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Navbar
  ],
  templateUrl: './channel-list.html',
  styleUrl: './channel-list.css'
})
export class ChannelList implements OnInit {

  groupId = '';

  groupName = '';

  channels = [
    {
      id: 'general',
      name: 'General',
      description: 'General discussion',
      members: 8
    },
    {
      id: 'announcements',
      name: 'Announcements',
      description: 'Important group announcements',
      members: 8
    },
    {
      id: 'games',
      name: 'Games',
      description: 'Gaming discussion',
      members: 6
    }
  ];

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {

    this.groupId =
      this.route.snapshot.paramMap.get('groupId') || '';

    if (this.groupId === 'gaming') {
      this.groupName = 'Gaming Group';
    } else if (this.groupId === 'study') {
      this.groupName = 'Study Group';
    } else {
      this.groupName = 'General Community';
    }
  }
}