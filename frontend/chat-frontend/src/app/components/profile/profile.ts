import { Component } from '@angular/core';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [Navbar],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile {

  currentUser: any = JSON.parse(
    localStorage.getItem('currentUser') ||
    '{"username":"User","age":0,"role":"user"}'
  );

  get initials(): string {
    return this.currentUser.username
      .substring(0, 2)
      .toUpperCase();
  }

  get roleName(): string {

    switch (this.currentUser.role) {

      case 'superAdmin':
        return 'Super Admin';

      case 'groupAdmin':
        return 'Group Admin';

      default:
        return 'Regular User';

    }

  }
}