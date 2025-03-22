import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {map} from "rxjs/operators";

export interface ChatNachricht {
  text: string;
  istNutzer: boolean;
  zeitstempel: number;
}

export interface ChatState {
  nachrichten: ChatNachricht[];
  laedt: boolean;
}

const INITIAL_CHAT_STATE: ChatState = {
  nachrichten: [],
  laedt: false,
};

@Injectable({
  providedIn: 'root',
})
export class ChatStore {
  private chatStateSubject = new BehaviorSubject<ChatState>(INITIAL_CHAT_STATE);
  private chatState$ = this.chatStateSubject.asObservable();

  constructor() {}

  /**
   * Gibt das aktuelle Chat-State Observable zurück.
   */
  getChatState(): Observable<ChatState> {
    return this.chatState$;
  }

  /**
   * Setzt den aktuellen Ladezustand des Chats.
   */
  setChatLaedt(laedt: boolean) {
    const currentState = this.chatStateSubject.getValue();
    this.chatStateSubject.next({ ...currentState, laedt });
  }

  /**
   * Fügt eine neue Nachricht zum Chat hinzu.
   */
  fuegeNachrichtHinzu(nachricht: ChatNachricht) {
    const currentState = this.chatStateSubject.getValue();
    this.chatStateSubject.next({
      ...currentState,
      nachrichten: [...currentState.nachrichten, nachricht],
    });
  }

  /**
   * Löscht den gesamten Chatverlauf.
   */
  loescheChat() {
    const currentState = this.chatStateSubject.getValue();
    this.chatStateSubject.next({ ...currentState, nachrichten: [] });
  }

  /**
   * Gibt alle Nachrichten als Observable zurück.
   */
  selectNachrichten(): Observable<ChatNachricht[]> {
    return this.chatState$.pipe(map((state) => state.nachrichten));
  }

  /**
   * Gibt den Ladezustand des Chats zurück.
   */
  selectChatLaedt(): Observable<boolean> {
    return this.chatState$.pipe(map((state) => state.laedt));
  }

  /**
   * Ersetzt den Chatverlauf durch neue Nachrichten.
   */
  setNachrichten(nachrichten: ChatNachricht[]) {
    const currentState = this.chatStateSubject.getValue();
    this.chatStateSubject.next({ ...currentState, nachrichten });
  }
}
