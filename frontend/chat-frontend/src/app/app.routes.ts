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
import { authGuard } from './auth.guard';
import { superAdminGuard, groupAdminGuard} from './role.guard';

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
    component: Dashboard,
    canActivate: [authGuard]
  },

  {
    path: 'groups',
    component: GroupList,
    canActivate: [authGuard]
  },

  {
    path: 'groups/manage',
    component: GroupManagement,
    canActivate: [groupAdminGuard]
  },

  {
    path: 'channels/:groupId',
    component: ChannelList,
    canActivate: [authGuard]
  },

  {
    path: 'channels/manage',
    component: ChannelManagement,
    canActivate: [groupAdminGuard]
  },

  {
    path: 'chat/:groupId/:channelId',
    component: ChatWindow,
    canActivate: [authGuard]
  },

  {
    path: 'profile',
    component: Profile,
    canActivate: [authGuard]
  },

  {
    path: 'user-management',
    component: UserManagement,
    canActivate: [superAdminGuard]
  },

  {
    path: '**',
    redirectTo: 'dashboard'
  }

];