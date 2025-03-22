import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ChatNachricht, ChatStore } from '../stores/chatbot.store';
import { ChatbotService } from '../services/chatbot.service';

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css']
})
export class ChatbotComponent implements OnInit {
  @ViewChild('nachrichtenContainer', { static: false }) nachrichtenContainer!: ElementRef;
  @ViewChild('chatEingabe', { static: false }) chatEingabe!: ElementRef;

  istChatOffen = false;
  nutzerNachricht: string = '';
  nachrichten: ChatNachricht[] = [];
  generiertAntwort = false;

  constructor(
    private chatbotService: ChatbotService,
    private chatStore: ChatStore
  ) {
    this.chatbotService.initModels().then(() => {
      console.log('RAG models initialized.');
    }).catch(err => console.error('Error initializing RAG models:', err));
  }

  /**
   * Initialisiert den Chat beim Laden der Komponente und lädt die gespeicherten Nachrichten.
   */
  ngOnInit(): void {
    this.chatStore.selectNachrichten().subscribe(nachrichten => this.nachrichten = nachrichten);

    this.chatbotService.getNutzerUuid().subscribe(uuid => {
      if (uuid) {
        this.chatbotService.setNutzerUuid(uuid);
        this.chatbotService.ladeChat();
      } else {
        console.warn('Keine Nutzer-UUID verfügbar.');
      }
    });
  }

  /**
   * Sendet die Nachricht des Nutzers an den Chatbot und speichert die Antwort.
   */
  async sendeNachricht(): Promise<void> {
    const nachricht = this.nutzerNachricht.trim();
    if (!nachricht) return;

    this.chatStore.fuegeNachrichtHinzu({ text: nachricht, istNutzer: true, zeitstempel: Date.now() });

    try {
      this.generiertAntwort = true;

      const relevanterInhalt = await this.chatbotService.getRelevantContent(nachricht);
      const botAntwort = await this.chatbotService.generateSummary(relevanterInhalt, nachricht);

      this.chatStore.fuegeNachrichtHinzu({ text: botAntwort, istNutzer: false, zeitstempel: Date.now() });
      await this.chatbotService.speichereChat(nachricht, botAntwort);
    } catch (error) {
      const fehlerAntwort = 'Es gab ein Problem, bitte versuchen Sie es später erneut.';
      this.chatStore.fuegeNachrichtHinzu({ text: fehlerAntwort, istNutzer: false, zeitstempel: Date.now() });
      await this.chatbotService.speichereChat(nachricht, fehlerAntwort);
    } finally {
      this.generiertAntwort = false;
      this.nutzerNachricht = '';
      this.scrolleNachUnten();
    }
  }

  /**
   * Öffnet oder schließt den Chat und fokussiert bei Öffnung das Eingabefeld.
   */
  chatUmschalten(): void {
    this.istChatOffen = !this.istChatOffen;

    if (this.istChatOffen) {
      setTimeout(() => {
        this.chatEingabe?.nativeElement.focus();
        this.scrolleNachUnten();
      }, 500);
    }
  }

  /**
   * Löscht den aktuellen Chatverlauf.
   */
  async chatGeloescht(): Promise<void> {
    await this.chatbotService.loescheChat();
    await this.chatbotService.ladeChat();
  }

  /**
   * Scrollt automatisch zum Ende des Chatverlaufs.
   */
  private scrolleNachUnten(): void {
    setTimeout(() => {
      this.nachrichtenContainer.nativeElement.scrollTo({
        top: this.nachrichtenContainer.nativeElement.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  }
}
