import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Navbar
  ],
  templateUrl: './group-list.html',
  styleUrl: './group-list.css'
})
export class GroupList implements OnInit {

  groups: any[] = [];

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"id":0,"username":"User","role":"user"}'
  );

  message = '';
  error = '';

  constructor(
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadGroups();
  }

  loadGroups() {

    this.http.get<any[]>(
      'http://localhost:3000/api/groups'
    ).subscribe({

      next: groups => {
        this.groups = groups;
      },

      error: error => {
        console.error('Could not load groups:', error);
      }

    });

  }

  isMember(group: any): boolean {

    return Array.isArray(group.memberIds) &&
      group.memberIds.includes(this.currentUser.id);

  }

  isAdmin(group: any): boolean {

    return Array.isArray(group.adminIds) &&
      group.adminIds.includes(this.currentUser.id);

  }

  requestToJoin(group: any) {

    this.message = '';
    this.error = '';

    if (this.isMember(group)) {
      return;
    }

    this.http.post<any>(
      'http://localhost:3000/api/requests',
      {
        type: 'join',
        requesterId: this.currentUser.id,
        groupId: group.id
      }
    ).subscribe({

      next: () => {

        this.message =
          `Your request to join "${group.name}" has been submitted.`;

      },

      error: error => {

        console.error('Could not submit join request:', error);

        this.error =
          error.error?.message ||
          `Could not submit a request to join "${group.name}".`;

      }

    });

  }

}