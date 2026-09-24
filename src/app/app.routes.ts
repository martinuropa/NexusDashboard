import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AdminComponent } from './pages/admin/admin.component';

export const routes: Routes = [
    {
        path: '',
        component: AdminComponent
    },
    {
        path: 'dashboard',
        component: DashboardComponent
    },
  
];
