import { Injectable } from '@angular/core';
import { AppDB, Chat, ChatNachricht } from './app-db.service';
import { from } from 'rxjs/internal/observable/from';
import { Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ChatDbService {
  constructor(private db: AppDB) {}

  /**
   * Speichert eine Nachricht und gibt eine Erfolgsmeldung zurück.
   *
   * @param nutzerUuid Nutzer-UUID
   * @param nutzerNachricht Nachricht des Nutzers
   * @param botAntwort Antwort des Bots
   * @returns void
   */
  async speichereChat(nutzerName: string, nutzerNachricht: string, botAntwort: string): Promise<void> {
    const zeitstempel = Date.now();
    const neueNachrichten: ChatNachricht[] = [
      { uuid: crypto.randomUUID(), text: nutzerNachricht, istNutzer: true, zeitstempel },
      { uuid: crypto.randomUUID(), text: botAntwort, istNutzer: false, zeitstempel },
    ];

    const chat = await this.db.chatverlauf.where('nutzerName').equals(nutzerName).first();
    if (chat) {
      chat.nachrichten.push(...neueNachrichten);
      await this.db.chatverlauf.update(chat.uuid, { nachrichten: chat.nachrichten });
    } else {
      const neuerChat: Chat = {
        uuid: crypto.randomUUID(),
        nutzerName,
        nachrichten: neueNachrichten,
      };
      await this.db.chatverlauf.add(neuerChat);
    }
  }

  /**
   * Lädt den Chatverlauf eines Nutzers.
   */
  async ladeChat(nutzerName: string): Promise<ChatNachricht[]> {
    const chat = await this.db.chatverlauf.where('nutzerName').equals(nutzerName).first();
    return chat ? chat.nachrichten : [];
  }

  /**
   * Löscht den gesamten Chatverlauf eines Nutzers aus der IndexedDB.
   *
   * @param chatUuid Der nutzerName des zu löschenden Chats
   * @returns Promise<void>
   */
  async loescheChat(nutzerName: string): Promise<void> {
    const chat = await this.db.chatverlauf.where('nutzerName').equals(nutzerName).first();
    if (chat) {
      await this.db.chatverlauf.delete(chat.uuid);
    }
  }

  /**
   * Löscht alle Chatverläufe (für Debugging oder Zurücksetzen)
   * @returns Observable<void>
   */
  loescheAlleChats(): Observable<void> {
    return from(this.db.chatverlauf.clear());
  }
}
