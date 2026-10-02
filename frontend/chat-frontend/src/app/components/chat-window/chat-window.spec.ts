import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { ChatWindow } from './chat-window';
import { SocketService } from '../../services/socket.service';
import { ChatMessage } from '../../models/chat.models';

// Stand-in for SocketService: no real connection, and the
// test can push "server" events through emitFromServer().
class FakeSocketService {

  connected = signal(true);

  private streams = new Map<string, Subject<any>>();

  sent: { channelId: number; text: string }[] = [];

  on<T>(event: string): Observable<T> {
    if (!this.streams.has(event)) {
      this.streams.set(event, new Subject<any>());
    }
    return this.streams.get(event)!.asObservable();
  }

  emitFromServer(event: string, data: any) {
    this.streams.get(event)?.next(data);
  }

  joinChannel() {
    return Promise.resolve({ ok: true, users: [] });
  }

  leaveChannel() {}

  sendTyping() {}

  sendMessage(channelId: number, text: string) {
    this.sent.push({ channelId, text });
    return Promise.resolve({ ok: true, message: makeMessage(99, text) });
  }
}

// Simulates picking a file in a hidden <input type="file">.
function fileEvent(file: File): Event {
  return { target: { files: [file], value: '' } } as unknown as Event;
}

function makeMessage(id: number, text: string, channelId = 1): ChatMessage {
  return {
    id,
    channelId,
    groupId: 1,
    userId: 2,
    username: 'bobby',
    text,
    imageUrl: null,
    timestamp: new Date().toISOString()
  };
}

describe('ChatWindow', () => {
  let component: ChatWindow;
  let fixture: ComponentFixture<ChatWindow>;
  let socket: FakeSocketService;

  beforeEach(async () => {
    socket = new FakeSocketService();

    await TestBed.configureTestingModule({
      imports: [ChatWindow],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SocketService, useValue: socket },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ groupId: '1', channelId: '1' })
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChatWindow);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adds a broadcast message to the timeline once', () => {
    const message = makeMessage(1, 'hello');

    socket.emitFromServer('newMessage', message);
    socket.emitFromServer('newMessage', message);

    const messages = component.timeline.filter(i => i.kind === 'message');
    expect(messages.length).toBe(1);
  });

  it('ignores messages for other channels', () => {
    socket.emitFromServer('newMessage', makeMessage(1, 'elsewhere', 2));

    expect(component.timeline.length).toBe(0);
  });

  it('removes a message when the server says it was deleted', () => {
    socket.emitFromServer('newMessage', makeMessage(1, 'oops'));
    socket.emitFromServer('messageDeleted', { id: 1, channelId: 1 });

    expect(component.timeline.length).toBe(0);
  });

  it('shows join and leave notices', () => {
    const at = new Date().toISOString();

    socket.emitFromServer('userJoined', { channelId: 1, userId: 3, username: 'ben', timestamp: at });
    socket.emitFromServer('userLeft', { channelId: 1, userId: 3, username: 'ben', timestamp: at });

    const notices = component.timeline
      .filter(i => i.kind === 'notice')
      .map(i => (i as any).text);

    expect(notices).toEqual([
      'ben joined the channel',
      'ben left the channel'
    ]);
  });

  it('shows who is typing', () => {
    socket.emitFromServer('typing', { channelId: 1, userId: 3, username: 'ben', isTyping: true });
    expect(component.typingText).toBe('ben is typing…');

    socket.emitFromServer('typing', { channelId: 1, userId: 3, username: 'ben', isTyping: false });
    expect(component.typingText).toBe('');
  });

  it('updates the online user list', () => {
    socket.emitFromServer('onlineUsers', {
      channelId: 1,
      users: [{ id: 2, username: 'bobby' }, { id: 3, username: 'ben' }]
    });

    expect(component.onlineUsers.length).toBe(2);
  });

  it('sends trimmed text over the socket and clears the box', async () => {
    component.messageText = '  hi there  ';

    await component.sendMessage();

    expect(socket.sent).toEqual([{ channelId: 1, text: 'hi there' }]);
    expect(component.messageText).toBe('');
  });

  it('rejects a non-image attachment before uploading', () => {
    component.onImageSelected(fileEvent(new File(['x'], 'doc.pdf', { type: 'application/pdf' })));

    expect(component.selectedImage).toBeNull();
    expect(component.errorMessage).toBe('Only PNG, JPG and GIF images are allowed');
  });

  it('uploads a selected image with its caption, then clears it', () => {
    // jsdom has no object URLs - stub them for the preview.
    URL.createObjectURL = () => 'blob:preview';
    URL.revokeObjectURL = () => {};

    const http = TestBed.inject(HttpTestingController);

    component.onImageSelected(fileEvent(new File(['gif'], 'cat.gif', { type: 'image/gif' })));
    expect(component.selectedImagePreview).toBe('blob:preview');

    component.messageText = ' my cat ';
    component.sendMessage();

    const req = http.expectOne('http://localhost:3000/api/channels/1/images');
    const body = req.request.body as FormData;
    expect(body.get('text')).toBe('my cat');
    expect((body.get('image') as File).name).toBe('cat.gif');

    req.flush({ ...makeMessage(5, 'my cat'), imageUrl: '/uploads/chat/c.gif' });

    expect(component.selectedImage).toBeNull();
    expect(component.messageText).toBe('');
    expect(socket.sent.length).toBe(0);
    const last = component.timeline[component.timeline.length - 1] as any;
    expect(last.message.imageUrl).toBe('/uploads/chat/c.gif');
  });

  it('marks the channel as joined once the server confirms', () => {
    expect(component.joined).toBe(true);
  });

  it('does not send before the join is confirmed', async () => {
    component.joined = false;
    component.messageText = 'too early';

    await component.sendMessage();

    expect(socket.sent.length).toBe(0);
  });

  it('does not send an empty message', async () => {
    component.messageText = '   ';

    await component.sendMessage();

    expect(socket.sent.length).toBe(0);
  });
});
