import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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

  channels: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit() {

    this.groupId =
      this.route.snapshot.paramMap.get('groupId') || '';

    this.loadChannels();
    this.loadGroup();

  }

  loadGroup() {

    if (!this.groupId) {
      return;
    }

    this.http.get<any>(
      `http://localhost:3000/api/groups/${this.groupId}`
    ).subscribe({
      next: group => {
        this.groupName = group.name;
      }
    });

  }

  loadChannels() {

    this.http.get<any[]>(
      `http://localhost:3000/api/groups/${this.groupId}/channels`
    ).subscribe({

      next: channels => {
        this.channels = channels;
      },

      error: error => {
        console.error(
          'Could not load channels:',
          error
        );
      }

    });
  }
}