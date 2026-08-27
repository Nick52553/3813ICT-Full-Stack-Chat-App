import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navbar } from '../navbar/navbar';

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [CommonModule, Navbar],
  templateUrl: './group-list.html',
  styleUrl: './group-list.css'
})
export class GroupList {
  allGroups: any[] = [];

  requestToJoin(group: any) {
    group.requestPending = true;
  }
}