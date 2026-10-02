import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Navbar } from '../navbar/navbar';
import {
  LIMITS,
  hasErrors,
  httpErrorMessage,
  validateAgeLimit,
  validateDescription,
  validateName,
  validateReason,
  validateRequired
} from '../../utils/validation';

type RequestType = 'group' | 'join' | 'channel' | 'ban';

// Every field that can show an error on this page.
type RequestField =
  | 'groupName'
  | 'groupDescription'
  | 'groupAgeLimit'
  | 'selectedGroup'
  | 'channelName'
  | 'channelDescription'
  | 'selectedUser'
  | 'banReason';

@Component({
  selector: 'app-requests',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Navbar
  ],
  templateUrl: './requests.html',
  styleUrl: './requests.css'
})
export class Requests implements OnInit {

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"id":0,"username":"User","role":"user"}'
  );

  requestType: RequestType = 'group';

  // A getter rather than a copied field, so the shared
  // constant is read when the template renders.
  get limits() { return LIMITS; }

  // Set once Submit is pressed, so field errors don't
  // show before anything has been typed.
  submitted = false;
  submitting = false;

  groupName = '';
  groupDescription = '';
  groupAgeLimit: number | null = 0;

  channelName = '';
  channelDescription = '';
  selectedGroup = '';

  selectedUser = '';
  banReason = '';

  groups: any[] = [];
  users: any[] = [];

  message = '';
  error = '';

  constructor(
    private http: HttpClient
  ) {}

  ngOnInit() {

    this.loadGroups();
    this.loadUsers();

  }

  loadGroups() {

    this.http.get<any[]>(
      'http://localhost:3000/api/groups'
    ).subscribe({

      next: groups => {
        this.groups = groups;
      },

      error: error => {
        console.error(error);
        this.error = 'Could not load groups.';
      }

    });

  }

  loadUsers() {

    this.http.get<any[]>(
      'http://localhost:3000/api/users'
    ).subscribe({

      next: users => {
        this.users = users;
      },

      error: error => {
        console.error(error);
        this.error = 'Could not load users.';
      }

    });

  }

  // Switch tabs and start the new form with no errors showing.
  selectType(type: RequestType) {
    this.requestType = type;
    this.submitted = false;
    this.error = '';
  }

  // Errors for the fields on the current tab only.
  get errors(): Partial<Record<RequestField, string | null>> {

    const group = validateRequired(this.selectedGroup, 'Please choose a group');

    switch (this.requestType) {

      case 'group':
        return {
          groupName: validateName(this.groupName, 'Group name'),
          groupDescription: validateDescription(this.groupDescription),
          groupAgeLimit: validateAgeLimit(this.groupAgeLimit)
        };

      case 'join':
        return { selectedGroup: group };

      case 'channel':
        return {
          selectedGroup: group,
          channelName: validateName(this.channelName, 'Channel name'),
          channelDescription: validateDescription(this.channelDescription)
        };

      case 'ban':
        return {
          selectedGroup: group,
          selectedUser: validateRequired(this.selectedUser, 'Please choose a user'),
          banReason: validateReason(this.banReason)
        };
    }
  }

  submitRequest() {

    this.message = '';
    this.error = '';
    this.submitted = true;

    if (hasErrors(this.errors) || this.submitting) {
      return;
    }

    let request: any;

    // ------------------------------
    // GROUP REQUEST
    // ------------------------------

    if (this.requestType === 'group') {

      request = {

        type: 'group',

        requesterId:
          this.currentUser.id,

        name:
          this.groupName.trim(),

        description:
          this.groupDescription.trim(),

        ageLimit:
          this.groupAgeLimit ?? 0

      };
    }

    // ------------------------------
    // JOIN REQUEST
    // ------------------------------

    if (this.requestType === 'join') {

      request = {

        type: 'join',

        requesterId:
          this.currentUser.id,

        groupId:
          Number(this.selectedGroup)

      };
    }

    // ------------------------------
    // CHANNEL REQUEST
    // ------------------------------

    if (this.requestType === 'channel') {

      request = {

        type: 'channel',

        requesterId:
          this.currentUser.id,

        groupId:
          Number(this.selectedGroup),

        name:
          this.channelName.trim(),

        description:
          this.channelDescription.trim()

      };
    }

    // ------------------------------
    // BAN / REMOVAL REQUEST
    // ------------------------------

    if (this.requestType === 'ban') {

      request = {

        type: 'ban',

        requesterId:
          this.currentUser.id,

        groupId:
          Number(this.selectedGroup),

        targetUserId:
          Number(this.selectedUser),

        reason:
          this.banReason.trim()

      };
    }

    this.submitting = true;

    this.http.post<any>(
      'http://localhost:3000/api/requests',
      request
    ).subscribe({

      next: () => {

        this.message =
          'Request submitted successfully.';

        this.submitting = false;

        this.clearForm();

      },

      error: error => {

        this.submitting = false;

        this.error =
          httpErrorMessage(error, 'Could not submit request.');

      }

    });

  }

  clearForm() {

    this.groupName = '';
    this.groupDescription = '';
    this.groupAgeLimit = 0;

    this.channelName = '';
    this.channelDescription = '';

    this.selectedGroup = '';
    this.selectedUser = '';

    this.banReason = '';

    this.submitted = false;

  }

}