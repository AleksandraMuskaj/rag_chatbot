import { Injectable } from '@angular/core';
import { pipeline } from '@xenova/transformers';
import {FrontendKommentareDokumentAdapter} from "../../core/frontendadapter";
import {GesetzeDBService} from "../../core/app-db/gesetze-db.service";

// DocumentEntry-Interface: Enthält den Originaltext und ein Array von Chunks,
// wobei jeder Chunk den entsprechenden Textausschnitt und das zugehörige Embedding enthält.
export interface DocumentEntry {
  content: string; // Originaltext (optional zur Volltextsuche)
  chunks: { text: string; embedding: number[] }[];
}
@Injectable({
  providedIn: 'root',
})
export class ImportService {
  constructor(
    private frontendAdapter: FrontendKommentareDokumentAdapter,
    private gesetzeDBService: GesetzeDBService
  ) {}

  /**
   * Teilt einen XML-Text in Chunks basierend auf der XML-Struktur.
   * Hier werden beispielsweise alle <norm>-Elemente ausgewertet und deren Textinhalt als eigener Chunk genutzt.
   * @param xmlText Der XML-Text.
   * @returns Array von Text-Chunks.
   */
  private splitXMLIntoChunks(xmlText: string): string[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    const normElements = xmlDoc.querySelectorAll("norm");
    const chunks: string[] = [];
    normElements.forEach(norm => {
      const textContent = norm.textContent;
      if (textContent && textContent.trim().length > 0) {
        chunks.push(textContent.trim());
      }
    });
    return chunks;
  }

  /**
   * Teilt einen langen reinen Text in kleinere Chunks anhand von doppelten Zeilenumbrüchen.
   * @param text Der zu segmentierende Text.
   * @param chunkSize Maximale Zeichenanzahl pro Chunk.
   * @returns Array von Text-Chunks.
   */
  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';
    for (const para of paragraphs) {
      if ((currentChunk + para).length < chunkSize) {
        currentChunk += para + '\n\n';
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = para + '\n\n';
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }

  /**
   * Liest eine Datei ein, bereinigt den Text, teilt ihn in Chunks auf (XML- oder textbasiert),
   * generiert für jeden Chunk ein Embedding und speichert das Dokument.
   * @param file Die zu importierende Datei.
   * @returns Das erstellte DocumentEntry-Objekt.
   */
  async importDocument(file: File): Promise<DocumentEntry> {
    // 1. Datei einlesen
    const text = await file.text();

    // 2. Überprüfen, ob es sich um eine XML-Datei handelt (Einfacher Check anhand des Beginns)
    let chunks: string[];
    if (text.trim().startsWith("<?xml")) {
      // XML-basierte Aufteilung anhand der <norm>-Elemente
      chunks = this.splitXMLIntoChunks(text);
      console.log(`XML-Dokument wurde in ${chunks.length} Chunks aufgeteilt.`);
    } else {
      // Reine Textbereinigung
      const cleaned = text
        .replace(/\u00a0/g, ' ')
        .replace(/&#\d+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      console.log('Importierter Text:', cleaned.slice(0, 100));
      const chunkSize = 1000; // Beispiel: 1000 Zeichen pro Chunk
      chunks = this.splitTextIntoChunks(cleaned, chunkSize);
      console.log(`Text wurde in ${chunks.length} Chunks aufgeteilt.`);
    }

    // 3. Embedding generieren – Verwende ein deutsches Embedding-Modell (z. B. jinaai/jina-embeddings-v2-base-de)
    const embeddingPipeline = await pipeline('feature-extraction', 'jinaai/jina-embeddings-v2-base-de', { quantized: false });
    // Parallele Generierung der Embeddings
    const chunkEmbeddings: { text: string; embedding: number[] }[] = await Promise.all(
      chunks.map(async (chunk) => {
        const result = await embeddingPipeline(chunk, { pooling: 'mean' });
        // Annahme: result[0].data enthält das Embedding als number[]
        const embedding = result.data as number[];
        return { text: chunk, embedding };
      })
    );
    if (chunkEmbeddings.length > 0) {
      console.log('Erstes Chunk-Embedding (erste 10 Werte):', chunkEmbeddings[0].embedding.slice(0, 10));
    }

    // 4. Erstelle das DocumentEntry-Objekt
    const document: DocumentEntry = {
      content: text, // Originaltext (optional für Volltextsuche)
      chunks: chunkEmbeddings
    };

    // 5. Speichere das Dokument über den FrontendAdapter im GesetzeDBService
    await this.frontendAdapter.speichereGesetz(document);
    console.log('Dokument erfolgreich gespeichert.');
    return document;
  }
}
