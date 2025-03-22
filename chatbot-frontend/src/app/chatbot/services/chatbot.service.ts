import { Inject, Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ChatStore } from '../stores/chatbot.store';
import { InferenceSession } from 'onnxruntime-web';
import {NutzerTo} from "../../core/app-db/konfiguration-db.service";
import {FrontendKommentareDokumentAdapter} from "../../core/frontendadapter";
import { AutoTokenizer, pipeline, cos_sim, env } from '@xenova/transformers';
import { Phi3SLM } from './Phi3SLM';
import * as ort from 'onnxruntime-web/webgpu';

@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  private extractor: any;
  phi3_slm: Phi3SLM;
  private tokenizer: any;
  private nutzerUuid: string | null = null;

  constructor(
    private frontendAdapter: FrontendKommentareDokumentAdapter,
    private chatStore: ChatStore
  ) {
    ort.env.wasm.wasmPaths = '/dist/';
    this.phi3_slm = new Phi3SLM();
  }

  async initModels(): Promise<void> {
    this.tokenizer = await AutoTokenizer.from_pretrained('Microsoft/Phi-3-mini-4k-instruct-onnx-web');
    await this.phi3_slm.loadONNX();
    await this.loadEmbeddingModel('jinaai/jina-embeddings-v2-base-de');
  }

  private async loadEmbeddingModel(modelName: string): Promise<void> {
    this.extractor = await pipeline('feature-extraction', modelName, { quantized: false });
  }

  async getRelevantContent(query: string): Promise<string> {
    const documents = await this.frontendAdapter.ladeGesetze();
    if (!documents.length) {
      return 'Keine Wissensdatenbank verfügbar.';
    }

    const queryEmbedding = (await this.extractor(query, { pooling: 'mean' }))[0].data;

    let bestMatch = { content: '', sim: -Infinity };
    for (const doc of documents) {
      for (const chunk of doc.chunks!) {
        const similarity = this.calculateCosSim(queryEmbedding, chunk.embedding);
        if (similarity > bestMatch.sim) {
          bestMatch = { content: chunk.text, sim: similarity };
        }
      }
    }

    return bestMatch.content;
  }

  async generateSummary(answer: string, query: string): Promise<string> {
    const hasContext = answer.trim() !== 'Keine Wissensdatenbank verfügbar.';

    const prompt = hasContext
      ? `<|system|>Du bist ein deutscher Assistent. Antworte bitte kurz und präzise auf die Frage des Nutzers und fasse den Kontext nur in wenigen Sätzen zusammen, ohne Wiederholungen.<|end|><|user|>Frage: ${query}\nKontext: ${answer}<|end|><|assistant|>`
      : `<|system|>Du bist ein deutscher Assistent. Bitte antworte ausschließlich basierend auf der Frage und gib keine erfundenen Informationen an, wenn kein Kontext vorhanden ist.<|end|><|user|>Frage: ${query}<|end|><|assistant|>`;

    return this.generateSummaryContent(prompt);
  }

  private async generateSummaryContent(prompt: string): Promise<string> {
    const { input_ids } = await this.tokenizer(prompt, { return_tensor: false, padding: true, truncation: true });

    this.phi3_slm.initilize_feed();

    const outputIndex = this.phi3_slm.output_tokens.length + input_ids.length;
    const outputTokens = await this.phi3_slm.generate(input_ids, () => {},{ max_tokens: 300 });

    let result = this.tokenizer.decode(outputTokens.slice(outputIndex), { skip_special_tokens: true });
    const idx = result.indexOf('*');
    if (idx !== -1) result = result.substring(0, idx).trim();
    return result; }

  getNutzerUuid(): Observable<string> {
    if (this.nutzerUuid) {
      return of(this.nutzerUuid);
    }

    return this.frontendAdapter.ermittleNutzerName().pipe(
      map((nutzer: NutzerTo) => nutzer.nutzerName || ''),
      catchError(() => of(''))
    );
  }

  setNutzerUuid(uuid: string | null): void {
    this.nutzerUuid = uuid;
    if (uuid) {
      localStorage.setItem('nutzerUuid', uuid);
    } else {
      localStorage.removeItem('nutzerUuid');
    }
  }

  async ladeChat(): Promise<any> {
    if (!this.nutzerUuid) throw new Error('Nutzer-UUID erforderlich');
    const chatVerlauf = await this.frontendAdapter.ladeChat(this.nutzerUuid);
    if (!chatVerlauf.length) this.setzeWillkommensnachricht();
    else this.chatStore.setNachrichten(chatVerlauf);
  }

  setzeWillkommensnachricht(): void {
    this.chatStore.setNachrichten([
      { text: '👋 Hallo! Ich bin dein virtueller Assistent. Wie kann ich dir helfen?',istNutzer: false, zeitstempel: Date.now() },
    ]);
  }

  async loescheChat(): Promise<void> {
    if (!this.nutzerUuid || this.nutzerUuid == null ) throw new Error('Nutzer-UUID erforderlich');
    await this.frontendAdapter.loescheChat(this.nutzerUuid);
  }

  async speichereChat(nutzerNachricht: string, botAntwort: string): Promise<void> {
    if (!this.nutzerUuid) throw new Error('Nutzer-UUID erforderlich');
    await this.frontendAdapter.speichereChat(this.nutzerUuid, nutzerNachricht, botAntwort);
  }

  // Wrapper function
  calculateCosSim(vec1: number[], vec2: number[]): number {
    return cos_sim(vec1, vec2);
  }
}
