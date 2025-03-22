import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImportComponent } from './components/import/import.component';
import {ChatbotComponent} from "../chatbot/components/chatbot.component";



@NgModule({
  declarations: [
    ImportComponent
  ],
  exports: [
    ImportComponent
  ],
  imports: [
    CommonModule
  ]
})
export class DashboardModule { }
