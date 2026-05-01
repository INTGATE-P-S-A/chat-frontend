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
  private _currentRequestOptions?: ChatRequestOptions;
  private _currentRequestId: string | null = null;

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

  private extractTextFromMultimodalContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      const textParts = content
        .filter(item => item.type === 'text' && item.text)
        .map(item => item.text);
      return textParts.join(' ');
    }
    
    return '';
  }

  private extractFilesFromMultimodalContent(content: any): MessageFile[] {
    if (!Array.isArray(content)) {
      return [];
    }
    
    const files: MessageFile[] = [];
    content.forEach((item, index) => {
      if (item.type === 'image' && item.image) {
        // Extract data from image data URI
        const dataUri = item.image;
        const mimeTypeMatch = dataUri.match(/^data:([^;]+);base64,/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
        const fileExtension = mimeType.split('/')[1] || 'jpg';
        const fileName = `image_${index + 1}.${fileExtension}`;
        
        files.push({
          id: crypto.randomUUID(),
          filename: fileName,
          originalName: fileName,
          mimeType: mimeType,
          size: 0, // We don't have size info from data URI, backend can handle this
          base64: dataUri,
          tmp: true
        });
      }
    });
    
    return files;
  }

  hostConnected() {
    // Listen for request ID events
    const hostElement = this.host as any;
    if (hostElement.addEventListener) {
      hostElement.addEventListener('chat:request:id', this.handleRequestId.bind(this));
    }
  }

  hostDisconnected() {
    const hostElement = this.host as any;
    if (hostElement.removeEventListener) {
      hostElement.removeEventListener('chat:request:id', this.handleRequestId.bind(this));
    }
    this.disconnectWebSocket();
  }

  private handleRequestId(event: CustomEvent) {
    this._currentRequestId = event.detail.requestId;
  }

  private disconnectWebSocket() {
    webSocketManager.disconnect();
  }

  private clear() {
    this._isAwaitingResponse = false;
    this._isProcessingResponse = false;
    this._generatingAnswer = false;
    this._hasReceivedFirstTextContent = false; // Reset for next message
    this._currentRequestId = null; // Clear request ID when clearing state
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
      socket.on(webSocketManager.websocketEvents.start, (data: { conversationId?: string, conversationUid?: string }) => {
        if (data.conversationId) {
          webSocketManager.conversationId = data.conversationId;
          
          // Dispatch the same event that the parser would dispatch
          const event = new CustomEvent('chat:conversation:start', {
            detail: { 
              conversationId: data.conversationId,
              conversationUid: data.conversationUid 
            },
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
            // Error processing WebSocket chunk
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

  async processResponse(response: string | BotResponse | Response, isUserMessage: boolean = false, useStream: boolean = false, overrides?: RequestOverrides, files?: MessageFile[], hidden?: boolean) {
    const timestamp = getTimestamp();
    const citations: Citation[] = [];
    let followupQuestions: string[] = [];
    let followingSteps: string[] = [];
    let thoughts: string | undefined;
    let dataPoints: string[] | undefined;
    
    // Use provided overrides or fall back to current request options
    const effectiveOverrides = overrides || this._currentRequestOptions?.overrides;
            

    const updateChatWithMessageOrChunk = async (message: string | BotResponse | Response, chunked: boolean) => {
      if (chunked) {
        // Always create a new AI message for each response
        let messageValue: string;
        let messageFiles = files;
        
        // Handle different message types
        if (isUserMessage) {
          // For user messages, use message text as-is (no gen-image extraction)
          messageValue = message as string;
          
          // Mark provided files as temporary for newly sent messages
          messageFiles = (files || []).map(file => ({ ...file, tmp: true }));
        } else {
          // For AI responses in streaming mode, start with empty content
          // The actual content will be populated by the streaming parser
          messageValue = '';
        }
        
        const initialEntry: ChatThreadEntry = {
          id: crypto.randomUUID(),
          text: [
            {
              value: messageValue,
              followingSteps: [],
            },
          ],
          followupQuestions: [],
          citations: [],
          timestamp: timestamp,
          isUserMessage: isUserMessage,
          thoughts: undefined,
          dataPoints: undefined,
          rawContent: messageValue, // Will be populated by the parser for AI responses
          model: !isUserMessage && effectiveOverrides?.selectedModel ? effectiveOverrides.selectedModel.model.value : undefined,
          // Add files if this is a user message and files are provided (though streaming is typically for AI responses)
          ...(isUserMessage && messageFiles && messageFiles.length > 0 ? { files: messageFiles } : {}),
          // Add hidden property if specified
          ...(hidden !== undefined ? { hidden } : {}),
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
        let messageValue: string;
        let messageFiles = files;
        
        if (isUserMessage) {
          // For user messages, use message text as-is (no gen-image extraction)
          messageValue = message as string;
          
          // Mark provided files as temporary for newly sent messages
          messageFiles = (files || []).map(file => ({ ...file, tmp: true }));
        } else {
          // For AI responses, use the message as-is
          messageValue = message as string;
        }
        
        this.processingMessage = {
          id: crypto.randomUUID(),
          text: [
            {
              value: messageValue,
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
          rawContent: isUserMessage ? messageValue : (message as string),
          model: !isUserMessage && effectiveOverrides?.selectedModel ? effectiveOverrides.selectedModel : undefined,
          // Add files if this is a user message and files are provided
          ...(isUserMessage && messageFiles && messageFiles.length > 0 ? { files: messageFiles } : {}),
          // Add hidden property if specified
          ...(hidden !== undefined ? { hidden } : {}),
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
      
      // Handle both string and multimodal content
      const contentText = typeof generatedResponse.content === 'string' 
        ? generatedResponse.content 
        : generatedResponse.content.map(c => c.text || '').join(' ');
        
      const processedText = processText(contentText, [citations, followingSteps, followupQuestions]);
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
    const { question, messages, files } = requestOptions;

    // Check if we have a question or messages with files or files in request options
    const hasFiles = (files && files.length > 0) || messages?.some(msg => msg.files && msg.files.length > 0);
    
    // Check if the last message in the messages array is a user message with multimodal content
    const hasMultimodalContent = messages && messages.length > 0 && 
      messages[messages.length - 1]?.role === 'user' && 
      Array.isArray(messages[messages.length - 1]?.content);

    // Check if we have a complete message array (not just legacy question/files)
    const hasCompleteMessages = messages && messages.length > 0;

    if (question || hasFiles || hasMultimodalContent || hasCompleteMessages) {
      try {
        // Store current request options for use in processResponse
        this._currentRequestOptions = requestOptions;
        
        this.generatingAnswer = true;
        
        // Create a new AbortController for this request
        this._abortController = new AbortController();

        // Only create a user message entry if we're using the legacy format (question/files without complete messages)
        if (requestOptions.type === 'chat' && !hasCompleteMessages) {
          if (question) {
            await this.processResponse(question, true, false, requestOptions.overrides, files);
          } else if (hasFiles) {
            // For files without text, create a placeholder message
            await this.processResponse('[File attachment]', true, false, requestOptions.overrides, files);
          }
        } else if (requestOptions.type === 'chat' && hasCompleteMessages) {
          // For complete messages array, create a user message entry from the last message for chat thread display
          const lastMessage = messages[messages.length - 1];
          if (lastMessage.role === 'user') {
            const messageText = this.extractTextFromMultimodalContent(lastMessage.content);
            const contentFiles = this.extractFilesFromMultimodalContent(lastMessage.content);
            
            // Filter out image files from the files array to avoid duplicates with multimodal content
            const nonImageFiles = (lastMessage.files || []).filter(file => {
              const fileType = file.mimeType;
              return fileType && !fileType.startsWith('image/');
            });
            
            // Combine content files (images) with non-image files from files array
            const allFiles = [...contentFiles, ...nonImageFiles];
            await this.processResponse(messageText || '', true, false, requestOptions.overrides, allFiles, lastMessage.hidden);
          }
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
            model: requestOptions.overrides?.selectedModel || undefined,
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

          await this.processResponse(response, false, httpOptions.stream, requestOptions.overrides);
        }
      } catch (error_: any) {
        const error = error_ as ChatResponseError;
        const chatError = {
          message: error?.code === 400 ? globalConfig.INVALID_REQUEST_ERROR : globalConfig.API_ERROR_MESSAGE,
        };

        if (!this.processingMessage) {
          // add a empty message to the chat thread to display the error
          await this.processResponse('', false, false, requestOptions.overrides);
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

  async cancelRequest() {
    // Save the request ID before aborting, since abort triggers clear() which nulls it
    const requestId = this._currentRequestId;

    // First abort the local stream
    this._abortController.abort();
    
    // Dispatch cancel event to the parent RWS component
    const hostElement = this.host as any;
    
    const cancelEvent = new CustomEvent('chat:cancel-request', {
      detail: { requestId },
      bubbles: true,
      composed: true
    });
    
    if (hostElement.dispatchEvent) {
      hostElement.dispatchEvent(cancelEvent);
    }
    
    this._currentRequestId = null;
    
    // Cancel WebSocket connection if active
    if (webSocketManager.socket && webSocketManager.isConnected) {
      webSocketManager.cancel();
    }
  }
}
