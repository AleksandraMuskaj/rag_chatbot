import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ChatbotComponent } from './chatbot.component';
import { ChatStore } from '../stores/chatbot.store';
import { of, throwError } from 'rxjs';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import {ChatbotService} from "../services/chatbot.service";

describe('ChatbotComponent', () => {
  let component: ChatbotComponent;
  let fixture: ComponentFixture<ChatbotComponent>;
  let mockChatbotService: any;
  let mockChatStore: any;

  beforeEach(async () => {
    mockChatbotService = {
      initModels: jasmine.createSpy('initModels').and.returnValue(Promise.resolve()),
      speichereChat: jasmine.createSpy('speichereChat').and.returnValue(Promise.resolve()),
      ladeChat: jasmine.createSpy('ladeChat').and.returnValue(Promise.resolve([])),
      loescheChat: jasmine.createSpy('loescheChat').and.returnValue(Promise.resolve()),
      getNutzerUuid: jasmine.createSpy('getNutzerUuid').and.returnValue(of('test-uuid')),
      getRelevantContent: jasmine.createSpy('getRelevantContent').and.returnValue(Promise.resolve('relevanter Inhalt')),
      generateSummary: jasmine.createSpy('generateSummary').and.returnValue(Promise.resolve('Bot-Antwort')),
      setNutzerUuid: jasmine.createSpy('setNutzerUuid'),
    };

    mockChatStore = {
      selectNachrichten: jasmine.createSpy().and.returnValue(of([])),
      fuegeNachrichtHinzu: jasmine.createSpy(),
      setNachrichten: jasmine.createSpy(),
    };

    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [ChatbotComponent],
      providers: [
        { provide: ChatStore, useValue: mockChatStore },
        { provide: ChatbotService, useValue: mockChatbotService }
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatbotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

    it('sollte die Komponente erstellen', () => {
      expect(component).toBeTruthy();
    });

    it('sollte Nachrichten beim Initialisieren laden', () => {
      component.ngOnInit();
      expect(mockChatStore.selectNachrichten).toHaveBeenCalled();
      expect(mockChatbotService.getNutzerUuid).toHaveBeenCalled();
    });

    it('sollte keine Nachricht senden, wenn Eingabe leer ist', async () => {
      component.nutzerNachricht = '  ';
      await component.sendeNachricht();
      expect(mockChatStore.fuegeNachrichtHinzu).not.toHaveBeenCalled();
    });

    it('sollte Nachricht senden und Antwort erhalten', async () => {
      mockChatbotService.getRelevantContent.and.returnValue(Promise.resolve('relevanter Inhalt'));
      mockChatbotService.generateSummary.and.returnValue(Promise.resolve('Test Antwort'));

      component.nutzerNachricht = 'Hallo';
      await component.sendeNachricht();

      expect(mockChatStore.fuegeNachrichtHinzu).toHaveBeenCalledTimes(2);
      expect(mockChatStore.fuegeNachrichtHinzu).toHaveBeenCalledWith(jasmine.objectContaining({
        text: 'Hallo',
        istNutzer: true,
      }));
      expect(mockChatStore.fuegeNachrichtHinzu).toHaveBeenCalledWith(jasmine.objectContaining({
        text: 'Es gab ein Problem, bitte versuchen Sie es später erneut.',
        istNutzer: false,
      }));
      expect(mockChatbotService.speichereChat).toHaveBeenCalled();
      expect(component.nutzerNachricht).toBe('');
    });

    it('sollte Fehler beim Generieren der Antwort behandeln', async () => {
      mockChatbotService.getRelevantContent.and.throwError('Test-Fehler');

      component.nutzerNachricht = 'Wie ist die Regelung zu XY?';
      await component.sendeNachricht();

      expect(mockChatStore.fuegeNachrichtHinzu).toHaveBeenCalledTimes(2);
      expect(mockChatStore.fuegeNachrichtHinzu).toHaveBeenCalledWith(jasmine.objectContaining({
        text: 'Wie ist die Regelung zu XY?',
        istNutzer: true,
      }));
      expect(mockChatStore.fuegeNachrichtHinzu).toHaveBeenCalledWith(jasmine.objectContaining({
        text: 'Es gab ein Problem, bitte versuchen Sie es später erneut.',
        istNutzer: false,
      }));
      expect(mockChatbotService.speichereChat).toHaveBeenCalledWith(
        'Wie ist die Regelung zu XY?',
        'Es gab ein Problem, bitte versuchen Sie es später erneut.'
      );
    });

    it('sollte Chat öffnen und Eingabefeld fokussieren', () => {
      component.chatEingabe = {nativeElement: {focus: jasmine.createSpy('focus')}} as any;
      component.nachrichtenContainer = {nativeElement: {scrollTo: jasmine.createSpy()}} as any;

      component.chatUmschalten();
      expect(component.istChatOffen).toBe(true);

      setTimeout(() => {
        expect(component.chatEingabe.nativeElement.focus).toHaveBeenCalled();
        expect(component.nachrichtenContainer.nativeElement.scrollTo).toHaveBeenCalled();
      }, 500);
    });

    it('sollte Chat löschen', async () => {
      await component.chatGeloescht();
      expect(mockChatbotService.loescheChat).toHaveBeenCalled();
      expect(mockChatbotService.ladeChat).toHaveBeenCalled();
    });

    it('sollte zum Ende des Chats scrollen', () => {
      component.nachrichtenContainer = {
        nativeElement: {
          scrollHeight: 1000,
          scrollTo: jasmine.createSpy()
        }
      } as any;

      component['scrolleNachUnten']();

      setTimeout(() => {
        expect(component.nachrichtenContainer.nativeElement.scrollTo).toHaveBeenCalledWith({
          top: 1000,
          behavior: 'smooth'
        });
      }, 100);
    });

    it('sollte Eingabefeld fokussieren nach dem Öffnen des Chats', fakeAsync(() => {
      component.chatEingabe = {nativeElement: {focus: jasmine.createSpy()}} as any;
      component.nachrichtenContainer = {nativeElement: {scrollTo: jasmine.createSpy()}} as any;

      component.chatUmschalten();
      tick(500);

      expect(component.chatEingabe.nativeElement.focus).toHaveBeenCalled();
      expect(component.nachrichtenContainer.nativeElement.scrollTo).toHaveBeenCalled();
    }));
  });
