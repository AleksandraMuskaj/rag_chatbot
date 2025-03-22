import { TestBed } from '@angular/core/testing';
import { ChatbotService } from './chatbot.service';
import { FrontendKommentareDokumentAdapter } from '../../core/frontendadapter';
import {ChatNachricht, ChatStore} from '../stores/chatbot.store';
import { of, throwError } from 'rxjs';
import {AutoTokenizer} from "@xenova/transformers";
import * as Transformers from '@xenova/transformers';


describe('ChatbotService', () => {
  let service: ChatbotService;
  let frontendAdapterMock: {
    ladeGesetze: jasmine.Spy<jasmine.Func>;
    ladeChat: jasmine.Spy<jasmine.Func>;
    ermittleNutzerName: jasmine.Spy<jasmine.Func>;
    speichereChat: jasmine.Spy<jasmine.Func>;
    loescheChat: jasmine.Spy<jasmine.Func>
  };
  let chatStoreMock: {
    setNachrichten: jasmine.Spy<(nachrichten: ChatNachricht[]) => void>;
    fuegeNachrichtHinzu: jasmine.Spy<(nachricht: ChatNachricht) => void>;
    selectNachrichten: jasmine.Spy<jasmine.Func>
  };
  let mockTokenizer: any;
  let phi3_slmMock: any;

  beforeEach(async () => {
    // Frontend-Adapter mocken
    frontendAdapterMock = {
      ladeGesetze: jasmine.createSpy().and.returnValue(Promise.resolve([])),
      ladeChat: jasmine.createSpy().and.returnValue(Promise.resolve([])),
      ermittleNutzerName: jasmine.createSpy().and.returnValue(of({ nutzerName: 'uuid' })),
      speichereChat: jasmine.createSpy().and.returnValue(Promise.resolve()),
      loescheChat: jasmine.createSpy().and.returnValue(Promise.resolve())
    };

    chatStoreMock = {
      setNachrichten: jasmine.createSpy(),
      fuegeNachrichtHinzu: jasmine.createSpy(),
      selectNachrichten: jasmine.createSpy().and.returnValue(of([]))
    };

    mockTokenizer = {
      decode: jasmine.createSpy('decode').and.returnValue('Mock Antwort'),
      encode: jasmine.createSpy().and.returnValue({ input_ids: [1, 2, 3] }),
      return_token_type_ids: false,
      _default_chat_template: '',
      _tokenizer_config: {},
      normalizer: {}
    };

    phi3_slmMock = {
      loadONNX: jasmine.createSpy('loadONNX').and.returnValue(Promise.resolve()),
      initilize_feed: jasmine.createSpy(),
      generate: jasmine.createSpy().and.returnValue(Promise.resolve([1,2,3,4,5])),
      output_tokens: []
    };

    await TestBed.configureTestingModule({
      providers: [
        ChatbotService,
        { provide: FrontendKommentareDokumentAdapter, useValue: frontendAdapterMock },
        { provide: ChatStore, useValue: chatStoreMock },
      ],
    }).compileComponents();

    service = TestBed.inject(ChatbotService);

    // Mock tokenizer und phi3_slm setzen
    (service as any).tokenizer = mockTokenizer;
    (service as any).phi3_slm = phi3_slmMock;
    spyOn(service as any, 'loadEmbeddingModel').and.returnValue(Promise.resolve());
  });

  it('sollte erstellt werden', () => {
    expect(service).toBeTruthy();
  });


  it('sollte Modelle initialisieren', async () => {
    spyOn(AutoTokenizer, 'from_pretrained').and.returnValue(Promise.resolve(mockTokenizer));

    await service.initModels();

    expect(AutoTokenizer.from_pretrained).toHaveBeenCalledWith('Microsoft/Phi-3-mini-4k-instruct-onnx-web');
    expect(phi3_slmMock.loadONNX).toHaveBeenCalled();
  });


  describe('getRelevantContent()', () => {
    beforeEach(() => {
      // Override cos_sim with a spy function
      spyOn(service, 'calculateCosSim').and.returnValue(0.9);
    });

    it('sollte relevanten Inhalt zurückgeben', async () => {
      frontendAdapterMock.ladeGesetze.and.returnValue(Promise.resolve([
        { chunks: [{ text: 'Test Inhalt', embedding: [0.1, 0.2] }] }
      ]));

      (service as any).extractor = jasmine.createSpy().and.returnValue(Promise.resolve([{ data: [0.1, 0.2] }]));

      const result = await service.getRelevantContent('Testanfrage');

      expect(result).toEqual('Test Inhalt');
      expect(frontendAdapterMock.ladeGesetze).toHaveBeenCalled();
    });

    it('sollte Fallback-Text liefern, wenn keine Dokumente vorhanden sind', async () => {
      frontendAdapterMock.ladeGesetze.and.returnValue(Promise.resolve([]));

      const result = await service.getRelevantContent('Testanfrage');

      expect(result).toBe('Keine Wissensdatenbank verfügbar.');
    });
  });

  describe('generateSummary()', () => {
    beforeEach(() => {
      spyOn(service as any, 'generateSummaryContent').and.returnValue(Promise.resolve('Zusammenfassung'));
    });

    it('generiert Prompt mit Kontext', async () => {
      const result = await service.generateSummary('Relevanter Inhalt', 'Frage?');

      expect(result).toEqual('Zusammenfassung');
      expect((service as any).generateSummaryContent).toHaveBeenCalledWith(jasmine.stringContaining('Kontext: Relevanter Inhalt'));
    });

    it('generiert Prompt ohne Kontext, wenn kein relevanter Inhalt verfügbar ist', async () => {
      const query = 'Was ist Datenschutz?';
      const erwarteterPrompt = `<|system|>Du bist ein deutscher Assistent. Bitte antworte ausschließlich basierend auf der Frage und gib keine erfundenen Informationen an, wenn kein Kontext vorhanden ist.<|end|><|user|>Frage: ${query}<|end|><|assistant|>`;

      const result = await service.generateSummary('Keine Wissensdatenbank verfügbar.', query);

      expect(result).toEqual('Zusammenfassung');
      expect((service as any).generateSummaryContent).toHaveBeenCalledWith(erwarteterPrompt);
    });
  });

  describe('Nutzer-UUID Verwaltung', () => {
    it('sollte NutzerUuid setzen und auslesen', () => {
      service.setNutzerUuid('test-uuid');
      service.getNutzerUuid().subscribe(uuid => expect(uuid).toEqual('test-uuid'));
    });

    it('sollte NutzerUuid laden, wenn noch nicht gesetzt', () => {
      frontendAdapterMock.ermittleNutzerName.and.returnValue(of({ nutzerName: 'uuid-von-adapter' }));

      service.getNutzerUuid().subscribe(uuid => {
        expect(uuid).toEqual('uuid-von-adapter');
        expect(frontendAdapterMock.ermittleNutzerName).toHaveBeenCalled();
      });
    });

    it('sollte leeren String zurückgeben, wenn Fehler beim Laden', () => {
      frontendAdapterMock.ermittleNutzerName.and.returnValue(throwError(() => new Error('Fehler')));

      service.getNutzerUuid().subscribe(uuid => {
        expect(uuid).toEqual('');
      });
    });
  });

  describe('ladeChat()', () => {
    beforeEach(() => {
      service.setNutzerUuid('test-uuid');
    });

    it('lädt und setzt vorhandenen Chat', async () => {
      frontendAdapterMock.ladeChat.and.returnValue(Promise.resolve([{ text: 'Chatnachricht', istNutzer: true, zeitstempel: Date.now() }]));

      await service.ladeChat();

      expect(frontendAdapterMock.ladeChat).toHaveBeenCalledWith('test-uuid');
      expect(chatStoreMock.setNachrichten).toHaveBeenCalled();
    });

    it('setzt Willkommensnachricht, wenn Chat leer ist', async () => {
      frontendAdapterMock.ladeChat.and.returnValue(Promise.resolve([]));
      spyOn(service, 'setzeWillkommensnachricht');

      await service.ladeChat();

      expect(service.setzeWillkommensnachricht).toHaveBeenCalled();
    });
  });

  describe('loescheChat()', () => {
    it('löscht Chat mit gültiger UUID', async () => {
      service.setNutzerUuid('test-uuid');
      await service.loescheChat();
      expect(frontendAdapterMock.loescheChat).toHaveBeenCalledWith('test-uuid');
    });

    it('wirft Fehler ohne UUID', async () => {
      service.setNutzerUuid(null);
      await expectAsync(service.loescheChat()).toBeRejectedWithError(Error, 'Nutzer-UUID erforderlich');
    });
  });

  describe('speichereChat()', () => {
    it('speichert Chat korrekt', async () => {
      service.setNutzerUuid('test-uuid');
      await service.speichereChat('Hallo', 'Antwort');
      expect(frontendAdapterMock.speichereChat).toHaveBeenCalledWith('test-uuid', 'Hallo', 'Antwort');
    });

    it('wirft Fehler ohne UUID', async () => {
      service.setNutzerUuid(null);
      await expectAsync(service.speichereChat('Hallo', 'Antwort')).toBeRejectedWithError('Nutzer-UUID erforderlich');
    });
  });
});
