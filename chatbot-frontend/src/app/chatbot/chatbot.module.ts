import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatbotComponent } from './components/chatbot.component';
import { ChatLoeschenModalComponent } from './components/chat-loeschen-modal/chat-loeschen-modal.component';
import {FormsModule} from "@angular/forms";



@NgModule({
  declarations: [
    ChatbotComponent,
    ChatLoeschenModalComponent
  ],
  exports: [
    ChatbotComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class ChatbotModule { }
