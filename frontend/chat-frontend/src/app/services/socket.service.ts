import { Injectable, OnDestroy, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

import { SocketAck } from '../models/chat.models';

const SOCKET_URL = 'http://localhost:3000';

// Wraps the single Socket.io connection used by the app.
// See backend/sockets.js for the list of events.
@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {

  private socket: Socket | null = null;

  // The channel we are in, so we can rejoin it
  // automatically after a dropped connection.
  private currentJoin: { userId: number; channelId: number } | null = null;

  // True while the socket is connected. Components can
  // read it in templates to show a "reconnecting" notice.
  readonly connected = signal(false);

  // Connect on first use rather than at startup, so pages
  // that don't need real-time chat never open a socket.
  private getSocket(): Socket {

    if (!this.socket) {

      this.socket = io(SOCKET_URL);

      let connectedBefore = false;

      this.socket.on('connect', () => {
        this.connected.set(true);

        // Rejoin after a REconnect - the server forgets our
        // rooms when the connection drops. (On the first
        // connect, the original join is already queued.)
        if (connectedBefore && this.currentJoin) {
          this.socket!.emit('joinChannel', this.currentJoin, () => {});
        }

        connectedBefore = true;
      });

      this.socket.on('disconnect', () => {
        this.connected.set(false);
      });
    }

    return this.socket;
  }

  // Emit an event and wait for the server's ack.
  private request(event: string, payload: object): Promise<SocketAck> {
    return new Promise(resolve => {
      this.getSocket().emit(event, payload, (ack: SocketAck) => resolve(ack));
    });
  }

  joinChannel(userId: number, channelId: number): Promise<SocketAck> {
    this.currentJoin = { userId, channelId };
    return this.request('joinChannel', { userId, channelId });
  }

  leaveChannel(channelId: number): void {

    if (this.currentJoin?.channelId === channelId) {
      this.currentJoin = null;
    }

    this.getSocket().emit('leaveChannel', { channelId }, () => {});
  }

  sendMessage(channelId: number, text: string): Promise<SocketAck> {
    return this.request('sendMessage', { channelId, text });
  }

  sendTyping(channelId: number, isTyping: boolean): void {
    this.getSocket().emit('typing', { channelId, isTyping });
  }

  // Listen for a server event. Unsubscribing removes
  // the listener, so components don't leak handlers.
  on<T>(event: string): Observable<T> {
    return new Observable<T>(subscriber => {

      const handler = (data: T) => subscriber.next(data);

      this.getSocket().on(event, handler);

      return () => this.socket?.off(event, handler);
    });
  }

  ngOnDestroy() {
    this.socket?.disconnect();
  }
}
