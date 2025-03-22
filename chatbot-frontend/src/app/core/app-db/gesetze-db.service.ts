import { Injectable } from '@angular/core';
import { AppDB, Chat, ChatNachricht, Gesetz } from './app-db.service';
import { from } from 'rxjs/internal/observable/from';
import { Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {DocumentEntry} from "../../dashboard/services/importservice.service";

@Injectable({
  providedIn: 'root',
})
export class GesetzeDBService {
  constructor(private db: AppDB) {}

  /**
   * Speichert ein importiertes Gesetz in die IndexedDB.
   *
   * @param gesetz
   */
  async speichereGesetz(gesetz : DocumentEntry): Promise<void> {
      await this.db.gesetze.put({ uuid: crypto.randomUUID(), content: gesetz.content, chunks: gesetz.chunks});
  }
  /**
   * Lädt alle importierten Gesetze.
   */
  async ladeGesetze(): Promise<Gesetz[]> {
    return this.db.gesetze.toArray();
  }

  /**
   * Sucht ein Gesetz nach Titel oder Abkürzung.
   */
  async sucheGesetz(titleOderAbkuerzung: string): Promise<Gesetz | undefined> {
    return this.db.gesetze
      .where('title')
      .equalsIgnoreCase(titleOderAbkuerzung)
      .or('abkuerzung')
      .equalsIgnoreCase(titleOderAbkuerzung)
      .first();
  }

  /**
   * Löscht ein importiertes Gesetz aus IndexedDB.
   */
  async loescheGesetz(uuid: string): Promise<void> {
    await this.db.gesetze.delete(uuid);
  }
}
