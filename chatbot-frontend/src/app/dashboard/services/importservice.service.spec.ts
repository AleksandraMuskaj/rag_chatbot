import { TestBed } from '@angular/core/testing';
import { FrontendKommentareDokumentAdapter } from '../../core/frontendadapter';
import { ChatDbService } from '../../core/app-db/chat-db.service';
import { GesetzeDBService } from '../../core/app-db/gesetze-db.service';

import { of } from 'rxjs';
import {ChatStore} from "../../chatbot/stores/chatbot.store";
import {ChatbotService} from "../../chatbot/services/chatbot.service";

describe('ChatbotService', () => {
  let service: ChatbotService;
  let mockFrontendAdapter: jasmine.SpyObj<FrontendKommentareDokumentAdapter>;
  let mockChatStore: jasmine.SpyObj<ChatStore>;

  beforeEach(() => {
    mockFrontendAdapter = jasmine.createSpyObj('FrontendKommentareDokumentAdapter', [
      'ladeGesetze',
      'ermittleNutzerName',
      'ladeChat',
      'loescheChat',
      'speichereChat'
    ]);

    mockChatStore = jasmine.createSpyObj('ChatStore', ['setNachrichten']);

    TestBed.configureTestingModule({
      providers: [
        ChatbotService,
        { provide: FrontendKommentareDokumentAdapter, useValue: mockFrontendAdapter },
        { provide: ChatStore, useValue: mockChatStore }
      ]
    });

    service = TestBed.inject(ChatbotService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should retrieve Nutzer UUID', (done) => {
    mockFrontendAdapter.ermittleNutzerName.and.returnValue(of({ nutzerName: 'test-uuid' }));

    service.getNutzerUuid().subscribe(uuid => {
      expect(uuid).toEqual('test-uuid');
      done();
    });
  });

  it('should set Nutzer UUID correctly', () => {
    service.setNutzerUuid('uuid-123');
    expect(localStorage.getItem('nutzerUuid')).toEqual('uuid-123');

    service.setNutzerUuid(null);
    expect(localStorage.getItem('nutzerUuid')).toBeNull();
  });

  it('should initialize models without errors', async () => {
    spyOn(service, 'initModels').and.returnValue(Promise.resolve());
    await service.initModels();
    expect(service.initModels).toHaveBeenCalled();
  });

  it('should handle empty gesetze DB gracefully', async () => {
    mockFrontendAdapter.ladeGesetze.and.returnValue(Promise.resolve([]));
    const content = await service.getRelevantContent('query');
    expect(content).toEqual('Keine Wissensdatenbank verfügbar.');
  });

  it('should set welcome message if chat is empty', async () => {
    mockFrontendAdapter.ladeChat.and.returnValue(Promise.resolve([]));
    spyOn(service, 'setzeWillkommensnachricht');

    service.setNutzerUuid('uuid');
    await service.ladeChat();

    expect(service.setzeWillkommensnachricht).toHaveBeenCalled();
  });

  it('should delete chat correctly', async () => {
    mockFrontendAdapter.loescheChat.and.returnValue(Promise.resolve());

    service.setNutzerUuid('uuid');
    await service.loescheChat();

    expect(mockFrontendAdapter.loescheChat).toHaveBeenCalledWith('uuid');
  });

  it('should save chat messages correctly', async () => {
    mockFrontendAdapter.speichereChat.and.returnValue(Promise.resolve());

    service.setNutzerUuid('uuid');
    await service.speichereChat('Hello', 'Hi');

    expect(mockFrontendAdapter.speichereChat).toHaveBeenCalledWith('uuid', 'Hello', 'Hi');
  });
});
