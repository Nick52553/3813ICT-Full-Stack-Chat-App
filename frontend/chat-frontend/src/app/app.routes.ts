import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Dashboard } from './components/dashboard/dashboard';
import { GroupList } from './components/group-list/group-list';
import { GroupManagement } from './components/group-management/group-management';
import { Profile } from './components/profile/profile';
import { UserManagement } from './components/user-management/user-management';


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
    path: 'profile',
    component: Profile
  },
  {
    path: 'admin/groups',
    component: GroupManagement
  },
  {
    path: 'admin/users',
    component: UserManagement
  },
  {
    // catch-all so a bad/unfinished link doesn't just sit there silently
    path: '**',
    redirectTo: 'dashboard'
  },
  {
  path: 'profile',
  component: Profile
},

{
  path: 'user-management',
  component: UserManagement
},
];