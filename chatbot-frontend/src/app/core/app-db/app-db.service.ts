import { Dexie, Table } from 'dexie';
import { Injectable } from '@angular/core';

export interface Kommentar {
  dokumentTyp: string;
  dokumentNummer: string;
  elementId: number;
  uuid: string;
  kommentar: string;
  elementVerweis?: string;
}

export interface KonfigurationsEintrag {
  key: string;
  value: string;
}

export interface ChatNachricht {
  uuid: string;
  text: string;
  istNutzer: boolean;
  zeitstempel: number;
}

export interface Chat {
  uuid: string;
  nutzerName: string;
  nachrichten: ChatNachricht[];
}

export interface Gesetz {
  uuid: string;
  content: string;
  chunks: {
    text: string;
    embedding: number[];
  }[];
}

/**
 * Konfiguration für die IndexedDb. Diese ist eine Client-seitiger Datenbank wo die Kommentare gespeichert werden, wenn der frontend Adapter ausgesucht is.
 */
@Injectable({
  providedIn: 'root',
})
export class AppDB extends Dexie {
  kommentare!: Table<Kommentar, [string, string, string, number]>;
  konfiguration!: Dexie.Table<KonfigurationsEintrag, string>;
  chatverlauf!: Table<Chat, string>;
  gesetze!: Table<Gesetz, string>;

  constructor() {
    super('AppDb');
    this.version(1).stores({
      kommentare: '[dokumentTyp+dokumentNummer+elementId+uuid], elementId, uuid',
    });

    this.version(2).stores({
      konfiguration: 'key',
    });

    this.version(3).stores({
      chatverlauf: 'uuid, nutzerName',
    });

    this.version(4).stores({
      gesetze: 'uuid, title, abkuerzung',
    });

    this.kommentare = this.table('kommentare');
    this.konfiguration = this.table('konfiguration');
    this.chatverlauf = this.table('chatverlauf');
    this.gesetze = this.table('gesetze');
    this.open()
      .then((data) => console.log('Frontend Datenbank gestartet.'))
      .catch((err) => console.error('Fehler beim Starten der Datenbank:', err.message));
  }
}
