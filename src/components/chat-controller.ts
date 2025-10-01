import { type ReactiveController, type ReactiveControllerHost } from 'lit';
import { getAPIResponse } from '../core/http/index.js';
import { getWebSocketResponse, webSocketManager, type WebSocketApiOptions } from '../core/stream/websocket.js';
import { parseStreamedMessages } from '../core/parser/index.js';
import { parseStreamedMessagesFromWebSocket } from '../core/parser/websocket-parser.js';
import { type ChatResponseError, getTimestamp, processText } from '../utils/index.js';
import { globalConfig } from '../config/global-config.js';
import { type Socket } from 'socket.io-client';

export class ChatController implements ReactiveController {
  host: ReactiveControllerHost;
  private _generatingAnswer: boolean = false;
  private _isAwaitingResponse: boolean = false;
  private _isProcessingResponse: boolean = false;
  private _processingMessage: ChatThreadEntry | undefined = undefined;
  private _abortController: AbortController = new AbortController();
  private _useWebSocket: boolean = false;
  private _onReasoningStep?: (reasoningId: string, step: string) => void;
  private _hasReceivedFirstTextContent: boolean = false;

  get isAwaitingResponse() {
    return this._isAwaitingResponse;
  }

  get isProcessingResponse() {
    return this._isProcessingResponse;
  }

  get processingMessage() {
    return this._processingMessage;
  }

  get generatingAnswer() {
    return this._generatingAnswer;
  }

  get signal() {
    return this._abortController.signal;
  }

  set generatingAnswer(value: boolean) {
    this._generatingAnswer = value;
    this.host.requestUpdate();
  }

  set processingMessage(value: ChatThreadEntry | undefined) {
    const previousMessage = this._processingMessage;
    
    this._processingMessage = value
      ? {
          ...value,
          // Preserve existing reasoning if it exists
          reasoning: this._processingMessage?.reasoning || value.reasoning,
        }
      : undefined;
    
    // Check if this is the first text content arriving after reasoning
    if (value && previousMessage && 
        !this._hasReceivedFirstTextContent &&
        previousMessage.reasoning && 
        value.text && value.text.length > 0 && 
        value.text[0].value && value.text[0].value.trim() !== '') {
      
      this._hasReceivedFirstTextContent = true;
      
      // Close the reasoning viewer for this message
      this.closeReasoningViewer(value.id);
    }
    
    // Force immediate update so reasoning can find the message
    this.host.requestUpdate();
  }

  addReasoningToProcessingMessage(step: string) {
    if (this._processingMessage) {
      this._processingMessage = {
        ...this._processingMessage,
        reasoning: (this._processingMessage.reasoning || '') + step
      };
      this.host.requestUpdate();
    }
  }

  private closeReasoningViewer(messageId: string) {    
    // Find the reasoning-viewer component for this message and close it
    const hostElement = this.host as any;
     const root = hostElement.shadowRoot;      

      const reasoningViewer = root.querySelector(`chat-thread-component`).shadowRoot.querySelector(`reasoning-viewer[component-id="${messageId}"]`);
      if (reasoningViewer && typeof reasoningViewer.close === 'function') {
        reasoningViewer.close();
      }
  }

  setReasoningCallback(callback: (reasoningId: string, step: string) => void) {
    this._onReasoningStep = callback;
  }

  set isAwaitingResponse(value: boolean) {
    this._isAwaitingResponse = value;
    this.host.requestUpdate();
  }

  set isProcessingResponse(value: boolean) {
    this._isProcessingResponse = value;
    this.host.requestUpdate();
  }

  constructor(host: ReactiveControllerHost) {
    (this.host = host).addController(this);
  }

  configureWebSocket(useWebSocket: boolean, websocketEvents: { start?: string; chunk?: string; end?: string; sendMessage?: string }) {
    this._useWebSocket = useWebSocket;
    webSocketManager.configure(websocketEvents);
  }

  hostConnected() {
    // no-op
  }

  hostDisconnected() {
    this.disconnectWebSocket();
  }

  private disconnectWebSocket() {
    webSocketManager.disconnect();
  }

  private clear() {
    this._isAwaitingResponse = false;
    this._isProcessingResponse = false;
    this._generatingAnswer = false;
    this._hasReceivedFirstTextContent = false; // Reset for next message
    this.host.requestUpdate(); // do update once
  }

  reset() {
    this._processingMessage = undefined;
    webSocketManager.conversationId = null;
    this.disconnectWebSocket();
    this.clear();
  }

  private async processWebSocketResponse(socket: Socket) {
    this.isProcessingResponse = true;

    // Set up event listeners for WebSocket
    if (webSocketManager.websocketEvents.start) {
      socket.on(webSocketManager.websocketEvents.start, (data: { conversationId?: string }) => {
        if (data.conversationId) {
          webSocketManager.conversationId = data.conversationId;
          
          // Dispatch the same event that the parser would dispatch
          const event = new CustomEvent('chat:conversation:start', {
            detail: { conversationId: data.conversationId },
            bubbles: true,
            composed: true
          });
          (this.host as any).dispatchEvent(event);
        }
      });
    }

    // Listen for chunk events
    if (webSocketManager.websocketEvents.chunk) {
      socket.on(webSocketManager.websocketEvents.chunk, async (chunk: any) => {
        if (this._processingMessage) {
          try {
            await parseStreamedMessagesFromWebSocket({
              chatEntry: this._processingMessage,
              chunk,
              onChunkRead: (updated) => {
                this.processingMessage = updated;
              },
              onCancel: () => {
                this.clear();
              },
            }, this.host);
          } catch (error) {
            console.error('Error processing WebSocket chunk:', error);
          }
        }
      });
    }

    // Listen for end event
    if (webSocketManager.websocketEvents.end) {
      socket.on(webSocketManager.websocketEvents.end, () => {
        this.clear();
      });
    }

    // Handle errors
    socket.on('error', () => {
      const chatError = {
        message: globalConfig.API_ERROR_MESSAGE,
      };

      if (this.processingMessage) {
        this.processingMessage = {
          ...this.processingMessage,
          error: chatError,
        };
      }
      this.clear();
    });
  }

  async processResponse(response: string | BotResponse, isUserMessage: boolean = false, useStream: boolean = false) {
    const timestamp = getTimestamp();
    const citations: Citation[] = [];
    let followupQuestions: string[] = [];
    let followingSteps: string[] = [];
    let thoughts: string | undefined;
    let dataPoints: string[] | undefined;
            

    const updateChatWithMessageOrChunk = async (message: string | BotResponse, chunked: boolean) => {
      if (chunked) {
        // Always create a new AI message for each response
        const initialEntry: ChatThreadEntry = {
          id: crypto.randomUUID(),
          text: [
            {
              value: '',
              followingSteps: [],
            },
          ],
          followupQuestions: [],
          citations: [],
          timestamp: timestamp,
          isUserMessage: false,
          thoughts: undefined,
          dataPoints: undefined,
          rawContent: '', // Will be populated by the parser
        };

        this.isProcessingResponse = true;
        this._abortController = new AbortController();
        this._hasReceivedFirstTextContent = false; // Reset for new message

        // Set the processing message immediately so reasoning can attach to it
        this.processingMessage = initialEntry;

        await parseStreamedMessages({
          chatEntry: initialEntry,
          signal: this._abortController.signal,
          apiResponseBody: (message as unknown as Response).body,
          onChunkRead: (updated) => {                   
            this.processingMessage = updated;
          },
          onCancel: () => {
            this.clear();
          },
          onReasoningStep: this._onReasoningStep,
        }, this.host);

        // processing done.
        this.clear();
      } else {
        // For non-streaming, create the message normally
        this.processingMessage = {
          id: crypto.randomUUID(),
          text: [
            {
              value: (message as string),
              followingSteps,
            },
          ],
          followupQuestions,
          citations: [...new Set(citations)],
          timestamp: timestamp,
          isUserMessage,
          thoughts,
          dataPoints,
          // For user messages, rawContent is the same as the message content
          // For AI responses in non-streaming mode, we don't have true rawContent, so use the message
          rawContent: isUserMessage ? (message as string) : (message as string),
        };
      }
    };

    // Check if message is a bot message to process citations and follow-up questions

    if (isUserMessage || typeof response === 'string') {
      await updateChatWithMessageOrChunk(response, false);
    } else if (useStream) {
      await updateChatWithMessageOrChunk(response, true);
    } else {
      // non-streamed response
      const generatedResponse = (response as BotResponse).choices[0].message;
      const processedText = processText(generatedResponse.content, [citations, followingSteps, followupQuestions]);
      const messageToUpdate = processedText.replacedText;
      // Push all lists coming from processText to the corresponding arrays
      citations.push(...(processedText.arrays[0] as unknown as Citation[]));
      followingSteps.push(...(processedText.arrays[1] as string[]));
      followupQuestions.push(...(processedText.arrays[2] as string[]));
      thoughts = generatedResponse.context?.thoughts ?? '';
      dataPoints = generatedResponse.context?.data_points ?? [];

      await updateChatWithMessageOrChunk(messageToUpdate, false);
    }
  }

  async generateAnswer(requestOptions: ChatRequestOptions, httpOptions: ChatHttpOptions, useWebSocket?: boolean, websocketUrl?: string) {
    const { question } = requestOptions;

    if (question) {
      try {
        this.generatingAnswer = true;
        
        // Create a new AbortController for this request
        this._abortController = new AbortController();

        // for chat messages, process user question as a chat entry
        if (requestOptions.type === 'chat') {
          await this.processResponse(question, true, false);
        }

        this.isAwaitingResponse = true;
        this.processingMessage = undefined;

        if (useWebSocket && this._useWebSocket && websocketUrl) {
          // Always create a new AI message for each WebSocket response
          const initialMessage: ChatThreadEntry = {
            id: crypto.randomUUID(),
            text: [
              {
                value: '',
                followingSteps: [],
              },
            ],
            followupQuestions: [],
            citations: [],
            timestamp: getTimestamp(),
            isUserMessage: false,
            thoughts: undefined,
            dataPoints: undefined,
            rawContent: '', // Will be populated by WebSocket parser
          };          // Use WebSocket - initialize processing message for WebSocket immediately
          this._hasReceivedFirstTextContent = false; // Reset for new WebSocket message
          this.processingMessage = initialMessage;

          // Use WebSocket
          const websocketOptions: WebSocketApiOptions = {
            url: websocketUrl,
            signal: this._abortController.signal,
            websocketEvents: webSocketManager.websocketEvents,
          };

          const socket = await getWebSocketResponse(requestOptions, websocketOptions);
          this.isAwaitingResponse = false;

          await this.processWebSocketResponse(socket);
        } else {
          // Use HTTP - let processResponse handle message creation
          const updatedHttpOptions = {
            ...httpOptions,
            signal: this._abortController.signal,
          };

          const response = (await getAPIResponse(requestOptions, updatedHttpOptions)) as BotResponse;
          this.isAwaitingResponse = false;

          await this.processResponse(response, false, httpOptions.stream);
        }
      } catch (error_: any) {
        const error = error_ as ChatResponseError;
        const chatError = {
          message: error?.code === 400 ? globalConfig.INVALID_REQUEST_ERROR : globalConfig.API_ERROR_MESSAGE,
        };

        if (!this.processingMessage) {
          // add a empty message to the chat thread to display the error
          await this.processResponse('', false, false);
        }

        if (this.processingMessage) {
          this.processingMessage = {
            ...this.processingMessage,
            error: chatError,
          };
        }
      } finally {
        this.clear();
      }
    }
  }

  cancelRequest() {
    this._abortController.abort();
    
    // Cancel WebSocket connection if active
    if (webSocketManager.socket && webSocketManager.isConnected) {
      webSocketManager.cancel();
    }
  }
}
