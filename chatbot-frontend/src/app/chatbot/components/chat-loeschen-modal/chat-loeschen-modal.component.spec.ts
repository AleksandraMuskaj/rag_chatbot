import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatLoeschenModalComponent } from './chat-loeschen-modal.component';

describe('ChatLoeschenModalComponent', () => {
  let component: ChatLoeschenModalComponent;
  let fixture: ComponentFixture<ChatLoeschenModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChatLoeschenModalComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatLoeschenModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
