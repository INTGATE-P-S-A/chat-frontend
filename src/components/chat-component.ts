/* eslint-disable unicorn/template-indent */
import { LitElement } from 'lit';
import DOMPurify from 'dompurify';
import { customElement, property, query, state } from 'lit/decorators.js';

import {
  chatHttpOptions,
  globalConfig as mainConfig,
  teaserListTexts as configTeaserListTexts,
  requestOptions,
} from '../config/global-config.js';
import { chatStyle } from '../styles/chat-component.js';
import { chatEntryToString, newListWithEntryAtIndex, addIconSheet } from '../utils/index.js';

import './link-icon.js';
import './chat-stage.js';
import './loading-indicator.js';
import './voice-input-button.js';
import './teaser-list-component.js';
import './document-previewer.js';
import './tab-component.js';
import './citation-list.js';
import './chat-thread-component.js';
import './chat-action-button.js';

import { ChatController } from './chat-controller.js';
import { StylesHelper } from '../helpers/StylesHelper.js';
import { InitMsgHelper } from '../helpers/InitMsgHelper.js';
import { EventsHelper } from '../helpers/EventsHelper.js';
import { RenderHelper } from '../helpers/RenderHelper.js';
import { SubmitHelper } from '../helpers/SubmitHelper.js';
import { ThreadHelper } from '../helpers/ThreadHelper.js';
import { HandlerHelper } from '../helpers/HandlerHelper.js';
import { FilesHelper } from '../helpers/FilesHelper.js';

let teaserListTexts = configTeaserListTexts;
let globalConfig = mainConfig;

const DEFAULT_CHAT_SETTINGS: IChatSettings = {
  imageModel: 'stableDiffusionXL',
  videoModel: null,
  voice: null,
  chatLearning: false
}

@customElement('chat-component')
export class ChatComponent extends LitElement {
  @property({ type: String, attribute: 'data-input-position' })
  inputPosition = 'sticky';

  @property({ type: String, attribute: 'data-interaction-model' })
  interactionModel: 'ask' | 'chat' = 'chat';

  @property({ type: String, attribute: 'data-api-url' })
  apiUrl = chatHttpOptions.url;

  @property({ type: String, attribute: 'data-custom-branding', converter: (value) => value?.toLowerCase() === 'true' })
  isCustomBranding: boolean = globalConfig.IS_CUSTOM_BRANDING;

  @property({ type: String, attribute: 'data-use-stream', converter: (value) => value?.toLowerCase() === 'true' })
  useStream: boolean = chatHttpOptions.stream;

  @property({ type: String, attribute: 'data-overrides', converter: (value) => JSON.parse(value || '{}') })
  overrides: RequestOverrides = {};

  @property({ type: String, attribute: 'data-custom-styles', converter: (value) => JSON.parse(value || '{}') })
  customStyles: any = {};

  @property({ type: String, attribute: 'data-custom-headers', converter: (value) => JSON.parse(value || '{}') })
  customHeaders: Record<string, string> = {};

  @property({ type: String, attribute: 'data-custom-teasers', converter: (value) => JSON.parse(value || '{}') })
  customTeasers: Record<string, string> = {};

  @property({ type: String, attribute: 'data-custom-config', converter: (value) => JSON.parse(value || '{}') })
  customConfig: Record<string, string> = {};

  @property({ type: Boolean, attribute: 'data-hide-delete-button', converter: (value) => value === 'true' })
  hideDeleteButton: Boolean = false;

  @property({ type: String, attribute: 'data-initial-messages', converter: (value) => JSON.parse(value || '[]') })
  initialMessages: ChatThreadEntry[] = [];

  @property({ type: Boolean, attribute: 'data-websocket', converter: (value) => value === 'true' })
  useWebSocket: boolean = false;

  @property({ type: String, attribute: 'data-websocket-events', converter: (value) => JSON.parse(value || '{}') })
  websocketEvents: { start?: string; chunk?: string; end?: string; sendMessage?: string } = {};

  @property({ type: String })
  currentQuestion = '';

  @property({ type: Boolean, attribute: 'data-web-search', converter: (value) => value === 'true' })
  dataWebSearch: boolean = false;

  @property({ type: Boolean, attribute: 'data-can-talk', converter: (value) => value === 'true' })
  dataCanTalk: boolean = false;

  @property({ type: Boolean, attribute: 'data-deep-search', converter: (value) => value === 'true' })
  dataDeepSearch: boolean = false;

  @query('#question-input')
  questionInput!: HTMLTextAreaElement;

  @query('#ai-assist-component')
  aiAssist!: IRWSAiAssistComponent;

  @state()
  activeAssist: IActiveAssist | null = null;

  @state()
  isDisabled = false;

  @state()
  isTalking = false;

  @state()
  upperLoader = false;

  @state()
  isChatStarted = false;

  @state()
  isResetInput = false;

  @state()
  webSearchEnabled = false;

  @state()
  deepSearchEnabled = false;

  @state()
  isFullscreen = false;

  @state()
  showControls = true;

  @state()
  liveChatOn = false;

  @state()
  showSettings = false;

  chatController = new ChatController(this);

  @state()
  showCode: { code: string, id: string, language: string, preview?: boolean, ended?: boolean } | null = null;

  @state()
  isDefaultPromptsEnabled: boolean = globalConfig.IS_DEFAULT_PROMPTS_ENABLED && !this.isChatStarted;

  @state()
  selectedCitation: Citation | undefined = undefined;

  @state()
  selectedChatEntry: ChatThreadEntry | undefined = undefined;

  @state()
  isShowingProgress = false;

  @state()
  progressPercentage = 0;

  @state()
  progressMessage = '';

  @state()
  progressStage = '';

  @state()
  chatSettings: IChatSettings = DEFAULT_CHAT_SETTINGS;

  @state()
  isAsideOpen = false;

  @state()
  promptFiles: MessageFile[] = [];

  @state()
  isDragOver = false;

  @property({ type: Number, attribute: 'data-convo-id' })
  convoId: number | null = null;

  chatThread: ChatThreadEntry[] = [];

  aiAssistantSignal: IExternalAssistSignal | null = null;

  private previousGeneratingAnswer: boolean = false; // Track previous generatingAnswer state

  static override styles = [chatStyle];


  override firstUpdated() {
    this.aiAssist.bindInputSource(this.questionInput);
    this.aiAssistantSignal = this.aiAssist.getExternalSignal();

    this.aiAssistantSignal?.value$.subscribe(async (value: IAssistSignalPayload | null) => {
      if (value?.command === 'pass_entry') {
        this.activeAssist = value?.payload;
      }
    });

    // Listen for webchat:submit event from ai-assist component
    this.aiAssist.addEventListener('webchat:submit', (event: Event) => {
      // Submit the form when ai-assist emits this event
      this.handleUserChatSubmit(event);
    });

    // Listen for webchat:text-insert event from ai-assist component (no auto-submit)
    this.aiAssist.addEventListener('webchat:text-insert', (event: Event) => {
      // Handle text insertion without auto-submit
      this.handleTextInsert(event as CustomEvent);
    });

    // Initialize textarea auto-resize
    setTimeout(() => {
      this.autoResizeTextarea();
      this.updateAssistContext();
    }, 100);
  }

  override updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    this.overrideConfig();

    if (changedProperties.has('customStyles')) {
      StylesHelper.setStyleColors(this.style, this.customStyles);
    }

    if (changedProperties.has('initialMessages') && this.initialMessages.length > 0 && this.chatThread.length === 0) {
      this.chatThread = InitMsgHelper.fillInitMessages(this.initialMessages);

      this.isChatStarted = true;
      this.isDefaultPromptsEnabled = false;

      // Update assist context when initial messages are loaded
      this.updateAssistContext();
    }

    if (changedProperties.has('useWebSocket') || changedProperties.has('websocketEvents')) {
      this.chatController.configureWebSocket(this.useWebSocket, this.websocketEvents);
    }

    // Auto-resize textarea when component layout changes
    if (changedProperties.has('isFullscreen') || changedProperties.has('isAsideOpen')) {
      setTimeout(() => this.autoResizeTextarea(), 100);
    }
  }

  override async connectedCallback() {
    super.connectedCallback();

    await addIconSheet.bind(this)();

    this.chatController.setReasoningCallback((_reasoningId: string, step: string) => {
      this.chatController.addReasoningToProcessingMessage(step);
    });

    const webSearchAttr = this.getAttribute('data-web-search');
    const deepSearchAttr = this.getAttribute('data-deep-search');

    if (webSearchAttr === 'true' || this.dataWebSearch === true) {
      this.webSearchEnabled = true;
    }

    if (deepSearchAttr === 'true' || this.dataDeepSearch === true) {
      this.deepSearchEnabled = true;
    }

    EventsHelper.listenToEvents.bind(this)();

    const savedChatSettings = localStorage.getItem('ai.chatSettings');

    if (savedChatSettings) {
      this.chatSettings = JSON.parse(savedChatSettings);
    }

    EventsHelper.listenForFullScreenEvents.bind(this)();

    this.overrideConfig();

    // Handle window resize to recalculate textarea height
    this.boundHandleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.boundHandleResize);

    const ev = new CustomEvent('chat-component-connected', {
      detail: true,
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(ev);
  }

  private boundHandleResize?: () => void;

  private handleResize(): void {
    // Debounce resize events
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = window.setTimeout(() => {
      this.autoResizeTextarea();
    }, 100);
  }

  private resizeTimeout?: number;

  override disconnectedCallback() {
    super.disconnectedCallback();

    EventsHelper.removeFullScreenEventListeners.bind(this)();

    // Clean up resize timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    // Remove resize event listener
    if (this.boundHandleResize) {
      window.removeEventListener('resize', this.boundHandleResize);
    }

    this.showControls = false;
    this.liveChatOn = false;
  }

  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    super.attributeChangedCallback(name, oldValue, newValue);

    // Handle dynamic attribute changes
    if (name === 'data-web-search') {
      this.webSearchEnabled = newValue === 'true';
    }

    if (name === 'data-deep-search') {
      this.deepSearchEnabled = newValue === 'true';
    }
  }

  static override get observedAttributes() {
    return [...(super.observedAttributes || []), 'data-web-search', 'data-deep-search'];
  }

  handleProgressEvent(event: Event) {
    const customEvent = event as CustomEvent;
    const { stage, message, percentage } = customEvent.detail;

    this.progressStage = stage || '';
    this.progressMessage = message || '';
    this.progressPercentage = percentage || 0;
    this.isShowingProgress = true;

    if (percentage >= 100 || stage === 'complete') {
      setTimeout(() => {
        this.isShowingProgress = false;
        this.progressPercentage = 0;
        this.progressMessage = '';
        this.progressStage = '';
      }, 1000);
    }
  }

  overrideConfig() {
    if (this.customConfig && Object.keys(this.customConfig).length > 0) {
      globalConfig = { ...mainConfig, ...this.customConfig };
    }
    if (this.customTeasers && Object.keys(this.customTeasers).length > 0) {
      teaserListTexts = this.customTeasers;
    }
  }

  clearChat() {
    ThreadHelper.clearChat.bind(this)();
  }

  setQuestionInputValue(value: string): void {
    this.questionInput.value = DOMPurify.sanitize(value || '');
    this.currentQuestion = this.questionInput.value;
    this.autoResizeTextarea();
  }

  public setInputValue(value: string, append: boolean = false): void {
    if (append) {
      const currentValue = this.questionInput.value || '';
      const newValue = currentValue + value;
      this.setQuestionInputValue(newValue);
    } else {
      this.setQuestionInputValue(value);
    }

    this.resetInputCheck();
  }

  resetInputCheck() {
    this.isResetInput = !!this.questionInput.value;
  }

  handleVoiceInput(event: CustomEvent): void {
    event?.preventDefault();
    this.setQuestionInputValue(event?.detail?.input);
    this.resetInputCheck();
  }

  handleRecordingStateChange(event: CustomEvent): void {
    event?.preventDefault();
    const { isRecording } = event.detail;

    const recordingStateEvent = new CustomEvent('recording-state-change', {
      detail: { isRecording },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(recordingStateEvent);
  }

  getMessageContext(): Message[] {
    return ThreadHelper.getMessageContext.bind(this)();
  }

  updateAssistContext(): void {
    HandlerHelper.handleDiscussionLLMTurn.bind(this)();
  }

  // New method to trigger AI assist analysis after LLM response
  async triggerAIAssistAfterLLMResponse(): Promise<void> {
    if (this.aiAssist && typeof (this.aiAssist as any).analyzeAfterLLMResponse === 'function') {
      try {
        await (this.aiAssist as any).analyzeAfterLLMResponse();
      } catch (error) {
        // Error handled silently
      }
    }
  }

  async handleUserChatSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.collapseAside(event);

    // Minimize AI assist window when submitting input
    if (this.aiAssist && typeof (this.aiAssist as any).toggleMinimize === 'function') {
      // Check if it's currently expanded (not minimized) before minimizing
      const currentMinimized = (this.aiAssist as any).minimized;
      if (!currentMinimized) {
        (this.aiAssist as any).toggleMinimize();
      }
    }

    // Clear any pending prompt-writing timeout in AI assist
    if (this.aiAssist && typeof (this.aiAssist as any).clearPromptWritingTimeout === 'function') {
      (this.aiAssist as any).clearPromptWritingTimeout();
    }

    await SubmitHelper.handleSubmit.bind(this)(requestOptions, chatHttpOptions);

    // Update assist context after user message is sent (but don't trigger analysis yet)
    setTimeout(() => {
      this.updateAssistContext();      
    }, 500);
  }

  resetInputField(event: Event): void {
    event.preventDefault();
    this.questionInput.value = '';
    this.currentQuestion = '';
    this.isResetInput = false;
    this.autoResizeTextarea();
  }

  startLiveChat(event: Event): void {
    event.preventDefault();
    this.showControls = false;
    this.liveChatOn = true;
  }

  showDefaultPrompts(event: Event): void {
    if (!this.isDefaultPromptsEnabled) {
      ThreadHelper.resetThread.bind(this)(event);
    }
  }

  handleOnInputChange(e: KeyboardEvent | Event): void {
    this.resetInputCheck();
    this.autoResizeTextarea();

    if (e instanceof KeyboardEvent && e.key === 'Enter' && !e.shiftKey && this.questionInput.value.trim().length > 0) {
      this.handleUserChatSubmit(e);
    }
  }

  async handlePasteEvent(e: ClipboardEvent): Promise<void> {
    // First handle file pasting through FilesHelper
    await FilesHelper.onPaste.bind(this)(e);
    
    // Then handle text auto-resize after a short delay to ensure paste content is processed
    setTimeout(() => {
      this.autoResizeTextarea();
      this.resetInputCheck();
    }, 10);
  }

  autoResizeTextarea(): void {
    if (!this.questionInput) return;

    // Reset height to auto to get the correct scrollHeight
    this.questionInput.style.height = 'auto';
    
    // Get the computed styles to access min and max height from CSS
    const computedStyle = getComputedStyle(this.questionInput);
    const minHeight = parseInt(computedStyle.minHeight) || 40;
    const maxHeight = parseInt(computedStyle.maxHeight) || 120;
    
    // Calculate the new height based on content
    const scrollHeight = this.questionInput.scrollHeight - 10;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    
    // Set the new height
    this.questionInput.style.height = `${newHeight}px`;
    
    // If content exceeds max height, enable scrolling
    if (scrollHeight > maxHeight) {
      this.questionInput.style.overflowY = 'auto';
    } else {
      this.questionInput.style.overflowY = 'hidden';
    }
  }

  handleUserChatCancel(event: Event): any {
    event?.preventDefault();
    this.chatController.cancelRequest();
  }

  handleCodeExpandAside(event: Event | undefined = undefined, code: { id: string, code: string, language: string, preview?: boolean, ended?: boolean } | null = null): void {
    event?.preventDefault();

    if (code) {
      if (this.showCode?.ended) {
        code.ended = true;
        code.preview = this.showCode.preview;
      }
      this.showCode = { ...this.showCode, ...code };
    } else {
      this.showCode = code;
    }

    this.openAside();
  }

  handleSettingsExpandAside(event: Event | undefined = undefined): void {
    event?.preventDefault();
    this.showSettings = true;
  }

  openAside() {
    this.isAsideOpen = true;
  }

  collapseAside(event: Event): void {
    event.preventDefault();
    this.selectedCitation = undefined;
    this.isAsideOpen = false;
  }



  override willUpdate(): void {
    const currentGeneratingAnswer = this.chatController.generatingAnswer;
    this.isDisabled = currentGeneratingAnswer;

    if (this.chatController.processingMessage) {
      const processingEntry = this.chatController.processingMessage as ChatThreadEntry;
      const index = this.chatThread.findIndex((entry) => entry.id === processingEntry.id);

      this.chatThread =
        index > -1
          ? newListWithEntryAtIndex(this.chatThread, index, processingEntry)
          : [...this.chatThread, processingEntry];

      // Signal to AI assist that LLM is streaming (don't update context during streaming to avoid infinite loops)
      if (this.aiAssist && typeof (this.aiAssist as any).setLLMStreaming === 'function') {
        (this.aiAssist as any).setLLMStreaming(true);
      }

    }

    // Check if generation just finished (transitioned from true to false)
    if (this.previousGeneratingAnswer && !currentGeneratingAnswer) {
      // Signal end of streaming to AI assist
      if (this.aiAssist && typeof (this.aiAssist as any).setLLMStreaming === 'function') {
        (this.aiAssist as any).setLLMStreaming(false);
      }

      // Update context and trigger analysis after LLM response is complete
      setTimeout(() => {
        this.updateAssistContext();
        this.triggerAIAssistAfterLLMResponse();
      }, 500); // Longer delay to ensure everything is settled
    }

    // Update previous state
    this.previousGeneratingAnswer = currentGeneratingAnswer;
  }

  public debugSlotContent() {

    const modelSelectSlot = this.shadowRoot?.querySelector('slot[name="model_select"]');

    const allSlots = this.shadowRoot?.querySelectorAll('slot');

    return {
      modelSelectSlot,
      allSlots,
      lightDOMContent: this.innerHTML,
      shadowDOMContent: this.shadowRoot?.innerHTML
    };
  }

  toggleTalk(value?: boolean) {
    if (value !== undefined) {
      this.isTalking = value;
      return;
    }

    this.isTalking = !this.isTalking;
  }

  toggleThreadLoading(value?: boolean) {
    if (value !== undefined) {
      this.upperLoader = value;
      return;
    }

    this.upperLoader = !this.upperLoader;
  }

  handleTextInsert(event: CustomEvent) {
    const { text } = event.detail;

    // Insert the text into the input field without auto-submitting
    if (this.questionInput && text) {
      this.questionInput.value = text;
      this.currentQuestion = text; // Update the reactive property
      this.questionInput.focus();

      // Trigger input event to update any reactive properties and reset input check
      this.questionInput.dispatchEvent(new Event('input', { bubbles: true }));
      this.autoResizeTextarea();
      this.resetInputCheck(); // Ensure reset button appears
      
      // Do NOT call SubmitHelper.handleSubmit - let user review and submit manually
    }

    // Clear the active assist to close the modal
    this.activeAssist = null;

    // Also clear the active entry in the ai-assist component
    if (this.aiAssist && typeof (this.aiAssist as any).clearActiveEntry === 'function') {
      (this.aiAssist as any).clearActiveEntry();
    }
  }

  handleSuggestionApplied(event: CustomEvent) {
    const text = event.detail.text;
    const suggestion: IAISuggestion = event.detail.suggestion;

    // Insert the suggestion text into the input field
    if (this.questionInput) {

      this.collapseAside(event);

      if (suggestion.context === 'kdb_attachment') {
        this.aiAssistantSignal?.setValue({
          command: 'attach_file',
          payload: suggestion.kdb
        });        
        
        this.dispatchEvent(new CustomEvent('selectionChanged', {          
          detail: { selectedIds: suggestion.kdb ? [suggestion.kdb.kdbId.toString()] : [] },
          bubbles: true,
          composed: true
        }));
        
      } else {
        // For all text suggestions, use the no-auto-submit flow
        this.questionInput.value = text;
        this.currentQuestion = text; // Update the reactive property
        this.questionInput.focus();

        // Trigger input event to update any reactive properties and reset input check
        this.questionInput.dispatchEvent(new Event('input', { bubbles: true }));
        this.autoResizeTextarea();
        this.resetInputCheck(); // Ensure reset button appears
        
        // NO AUTO-SUBMIT - let user review and submit manually
      }
    }

    // Clear the active assist to close the modal
    this.activeAssist = null;

    // Also clear the active entry in the ai-assist component
    if (this.aiAssist && typeof (this.aiAssist as any).clearActiveEntry === 'function') {
      (this.aiAssist as any).clearActiveEntry();
    }
  }

  handleSuggestionsModalClose() {
    this.activeAssist = null;

    // Also clear the active entry in the ai-assist component
    if (this.aiAssist && typeof (this.aiAssist as any).clearActiveEntry === 'function') {
      (this.aiAssist as any).clearActiveEntry();
    }
  }

  override render() {
    return RenderHelper.mainRender.bind(this)(globalConfig, teaserListTexts);
  }
}
