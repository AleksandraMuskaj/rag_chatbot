import { Component } from '@angular/core';
import {DocumentEntry, ImportService} from "../../services/importservice.service";
import {Gesetz} from "../../../core/app-db/app-db.service";

@Component({
  selector: 'app-import',
  templateUrl: './import.component.html',
  styleUrls: ['./import.component.css']
})
export class ImportComponent {
  selectedFile: File | null = null;
  importStatus: string = '';
  importedDocument: DocumentEntry | null = null;

  constructor(private importService: ImportService) {}

  async onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.selectedFile = event.target.files[0];
      this.importStatus = 'Datei ausgewählt, Import läuft...';
      try {
        const doc = await this.importService.importDocument(this.selectedFile!);
        this.importStatus = 'Import erfolgreich!';
        this.importedDocument = doc;
      } catch (error) {
        console.error('Fehler beim Importieren:', error);
        this.importStatus = 'Fehler beim Importieren.';
      }
    }
  }
}
