import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {ChatStore} from "../chatbot/stores/chatbot.store";
import {ChatDbService} from "./app-db/chat-db.service";
import {GesetzeDBService} from "./app-db/gesetze-db.service";
import {catchError, map} from "rxjs/operators";
import {env} from "@xenova/transformers";
import {DocumentEntry} from "../dashboard/services/importservice.service";
import {KonfigurationDbService} from "./app-db/konfiguration-db.service";

export interface NutzerTo {
  nutzerName: string;
}

@Injectable({
  providedIn: 'root',
})
export class FrontendKommentareDokumentAdapter {

  constructor(
    private chatStore: ChatStore,
    private gesetzeDbService: GesetzeDBService,
    protected chatDbService: ChatDbService,
    protected konfigurationDbService: KonfigurationDbService
  ) {}

  /**
   * Simuliert das Abrufen des Nutzernamens aus einer Datenbank oder einem Service.
   */
  ermittleNutzerName(): Observable<NutzerTo> {
    return of({ nutzerName: 'DummyNutzer' });
  }

  async speichereChat(nutzerName: string, nutzerNachricht: string, botAntwort: string): Promise<void> {
    await this.chatDbService.speichereChat(nutzerName, nutzerNachricht, botAntwort);
  }

  async ladeChat(nutzerName: string): Promise<{ text: string; istNutzer: boolean; zeitstempel: number }[]> {
    return await this.chatDbService.ladeChat(nutzerName);
  }

  async loescheChat(nutzerUuid: string): Promise<void> {
    await this.chatDbService.loescheChat(nutzerUuid);
  }

  loescheAlleChats() {
    this.chatDbService.loescheAlleChats().subscribe({
      next: () => console.log('Alle Chats erfolgreich gelöscht'),
      error: (err) => console.error('Fehler beim Löschen aller Chats:', err),
    });
  }

  async speichereGesetz(gesetz : DocumentEntry): Promise<void> {
    await this.gesetzeDbService.speichereGesetz(gesetz);
  }

  async ladeGesetze(): Promise<DocumentEntry[]> {
    return await this.gesetzeDbService.ladeGesetze();
  }

  async loescheGesetz(gesetzId: string): Promise<void> {
    await this.gesetzeDbService.loescheGesetz(gesetzId);
  }
}
