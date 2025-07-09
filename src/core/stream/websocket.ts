import { io, Socket } from 'socket.io-client';
import { ChatResponseError } from '../../utils/index.js';

// WebSocket state management
class WebSocketManager {
  private _socket: Socket | null = null;
  private _isConnected: boolean = false;
  private _conversationId: string | null = null;
  private _websocketEvents: { start?: string; chunk?: string; end?: string; sendMessage?: string } = {};

  get socket() {
    return this._socket;
  }

  get isConnected() {
    return this._isConnected;
  }

  get conversationId() {
    return this._conversationId;
  }

  get websocketEvents() {
    return this._websocketEvents;
  }

  set conversationId(id: string | null) {
    this._conversationId = id;
  }

  configure(websocketEvents: { start?: string; chunk?: string; end?: string; sendMessage?: string }) {
    this._websocketEvents = websocketEvents;
  }

  connect(url: string): Promise<Socket> {
    const socket = io(url);
    this._socket = socket;

    return new Promise((resolve, reject) => {
      socket.on('connect', () => {
        this._isConnected = true;
        resolve(socket);
      });

      socket.on('connect_error', () => {
        this._isConnected = false;
        reject(new ChatResponseError('WebSocket connection failed', 500));
      });

      socket.on('error', (error) => {
        reject(new ChatResponseError(error.message || 'WebSocket error', 500));
      });

      socket.on('disconnect', () => {
        this._isConnected = false;
      });
    });
  }

  disconnect() {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
      this._isConnected = false;
      this._conversationId = null;
    }
  }

  sendMessage(requestData: any) {
    if (!this._socket || !this._isConnected) {
      throw new Error('WebSocket not connected');
    }

    // Send the message using the configured event name
    if (this._websocketEvents.sendMessage) {
      this._socket.emit(this._websocketEvents.sendMessage, requestData);
    } else {
      this._socket.emit('sendMessage', requestData);
    }
  }

  cancel() {
    if (this._socket && this._isConnected) {
      this._socket.emit('cancel');
      this.disconnect();
    }
  }
}

// Global WebSocket manager instance
const webSocketManager = new WebSocketManager();

export async function callWebSocketApi(
  { question, type, approach, overrides, messages }: ChatRequestOptions,
  { url, signal, websocketEvents }: WebSocketApiOptions,
): Promise<Socket> {
  webSocketManager.configure(websocketEvents);
  const socket = await webSocketManager.connect(url);

  const requestData = {
    messages: [
      ...(messages ?? []),
      {
        content: question,
        role: 'user',
      },
    ],
    context: {
      ...overrides,
      approach,
    },
    stream: type === 'chat' ? true : false,
  };

  webSocketManager.sendMessage(requestData);

  // Handle abort signal
  if (signal) {
    signal.addEventListener('abort', () => {
      webSocketManager.cancel();
    });
  }

  return socket;
}

export async function getWebSocketResponse(
  requestOptions: ChatRequestOptions,
  websocketOptions: WebSocketApiOptions,
): Promise<Socket> {
  const socket = await callWebSocketApi(requestOptions, websocketOptions);
  return socket;
}

// Export WebSocket manager for external access
export { webSocketManager };

// WebSocket-specific options interface
export interface WebSocketApiOptions {
  url: string;
  signal?: AbortSignal;
  websocketEvents: {
    start?: string;
    chunk?: string;
    end?: string;
    sendMessage?: string;
  };
}
