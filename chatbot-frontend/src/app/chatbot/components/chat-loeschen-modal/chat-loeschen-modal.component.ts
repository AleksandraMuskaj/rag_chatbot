import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ChatStore} from "../../stores/chatbot.store";
import {ChatbotService} from "../../services/chatbot.service";


@Component({
  selector: 'app-chat-loeschen-modal',
  templateUrl: './chat-loeschen-modal.component.html',
  styleUrls: ['./chat-loeschen-modal.component.css'],
})
export class ChatLoeschenModalComponent {
  @Output() chatGeloescht = new EventEmitter<void>();
  isModalVisible = false; // Track visibility of modal

  constructor(private chatStore: ChatStore, private chatbotService: ChatbotService) {}

  openModal() {
    this.isModalVisible = true;
  }

  abbrechen() {
    this.isModalVisible = false;
  }

  async bestaetigen() {
    try {
      await this.chatbotService.loescheChat();
      this.chatStore.loescheChat();
      this.chatGeloescht.emit();
      console.log('Chat erfolgreich gelöscht');
    } catch (error) {
      console.error('Fehler beim Löschen des Chats:', error);
    } finally {
      this.abbrechen();
    }
  }
}

