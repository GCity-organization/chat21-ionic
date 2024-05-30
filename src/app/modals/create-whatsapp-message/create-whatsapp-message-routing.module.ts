import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SendWhatsappMessagePage } from './create-whatsapp-message.page';

const routes: Routes = [
  {
    path: '',
    component: SendWhatsappMessagePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SendWhatsappMessageRoutingModule {}
