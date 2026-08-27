import { Routes } from '@angular/router';

import { Login } from './components/login/login';
import { Dashboard } from './components/dashboard/dashboard';
import { Profile } from './components/profile/profile';
import { UserManagement } from './components/user-management/user-management';
import { GroupList } from './components/group-list/group-list';
import { GroupManagement } from './components/group-management/group-management';
import { ChannelList } from './components/channel-list/channel-list';
import { ChannelManagement } from './components/channel-management/channel-management';
import { ChatWindow } from './components/chat-window/chat-window';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: 'login',
    component: Login
  },

  {
    path: 'dashboard',
    component: Dashboard
  },

  {
    path: 'groups',
    component: GroupList
  },

  {
    path: 'groups/manage',
    component: GroupManagement
  },

  {
    path: 'channels/:groupId',
    component: ChannelList
  },

  {
    path: 'channels/manage',
    component: ChannelManagement
  },

  {
    path: 'chat/:groupId/:channelId',
    component: ChatWindow
  },

  {
    path: 'profile',
    component: Profile
  },

  {
    path: 'user-management',
    component: UserManagement
  },

  {
    path: '**',
    redirectTo: 'dashboard'
  }
];