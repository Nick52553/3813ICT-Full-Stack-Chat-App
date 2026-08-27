import { Component } from '@angular/core';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [Navbar],
  templateUrl: './user-management.html',
  styleUrl: './user-management.css'
})
export class UserManagement {}