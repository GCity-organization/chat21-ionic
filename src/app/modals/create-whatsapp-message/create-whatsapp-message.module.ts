import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SendWhatsappMessageRoutingModule } from './create-whatsapp-message-routing.module';
import { SendWhatsappMessagePage } from './create-whatsapp-message.page';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateLoader, TranslateModule} from '@ngx-translate/core';
import { createTranslateLoader } from '../../../chat21-core/utils/utils';
import { HttpClient } from '@angular/common/http';
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SendWhatsappMessageRoutingModule,
    NgSelectModule,
    TranslateModule.forChild({
      loader: {
        provide: TranslateLoader,
        useFactory: (createTranslateLoader),
        deps: [HttpClient]
      }
    })
  ],
  declarations: [SendWhatsappMessagePage]
})
export class SendWhatsappMessageModule {}
