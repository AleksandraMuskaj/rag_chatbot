import { Injectable } from '@angular/core';
import { AppDB, KonfigurationsEintrag } from './app-db.service';
import { from, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface NutzerTo {
  id?: number;
  nutzerName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class KonfigurationDbService {
  constructor(private db: AppDB) {}

  /**
   * Lädt die Konfiguration mit den Nutzernamen aus der Datenbank.
   */
  getNutzer(): Observable<NutzerTo> {
    return from(this.db.konfiguration.get('nutzername')).pipe(
      map((x: KonfigurationsEintrag | undefined) => {
        if (!x) {
          throw new Error('Nutzername nicht gefunden');
        }
        return { nutzerName: x?.value };
      }),
      catchError((error) => {
        throw new Error('Fehler beim Laden der Nutzername');
      })
    );
  }

  /**
   * Speichert eine Konfiguration mit den Nutzernamen in der Datenbank.
   * @param name Der Nutzername.
   */
  setNutzer(name: string): Observable<unknown> {
    return from(
      this.db.konfiguration
        .put({
          key: 'nutzername',
          value: name,
        })
        .catch((error) => {
          throw new Error('Fehler beim Speichern der Nutzername');
        })
    );
  }

  /**
   * Löscht den Konfigurationseintrag von der Datenbank.
   */
  deleteNutzer(): Observable<unknown> {
    return from(this.db.konfiguration.delete('nutzername')).pipe(
      catchError((error) => {
        throw new Error('Fehler beim Löschen der Nutzername');
      })
    );
  }
}
