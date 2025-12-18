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
import { newListWithEntryAtIndex, addIconSheet } from '../utils/index.js';

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
import { KeyboardShortcutsHelper } from '../helpers/KeyboardShortcutsHelper.js';

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
  questionInput!: HTMLElement & {
    setValue: (value: string) => void;
    getValue: () => string;
    setInputValue: (value: string, append?: boolean) => void;
    focus: () => void;
    blur: () => void;
    autoResize: () => void;
    getHtmlValue?: () => string;
  };

  @query('#ai-assist-component')
  aiAssist?: IRWSAiAssistComponent;

  @query('#prompt-autocomplete-component')
  autocompleteTriggers!: IRWSAutocompleteTriggerComponent;

  @query('#prompt-slots')
  promptSlots!: { value: IPromptSlotsContent | null } & HTMLElement;

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
  advancedPromptingEnabled = false;

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

  @state()
  enterSubmitBlocked = false;

  @state()
  currentUser: IRWSUser | null = null;

  @state()
  currentBalance: number = 0;

  @state()
  selectedStyles: { type: string; id: string; title: string }[]  = [];

  @state()
  selectedProjects: { type: string; id: string; title: string }[]  = [];

  @state()
  selectedKnowledge: string[] = [];

  @property({ type: Number, attribute: 'data-convo-id' })
  convoId: number | null = null;

  chatThread: ChatThreadEntry[] = [];

  aiAssistantSignal: IExternalAssistSignal | null = null;
  creditBalanceSignal: IExternalBalanceSignal | null = null;

  private previousGeneratingAnswer: boolean = false; // Track previous generatingAnswer state

  static override styles = [chatStyle];


  override firstUpdated() {
    // Note: Autocomplete and AI assist expect HTMLTextAreaElement, but mirror-textarea is a custom element
    // For now, we'll skip binding to these components until they can handle custom elements
    // this.autocompleteTriggers.bindTextarea(this.questionInput);
    
    // Only initialize AI assist if the feature is enabled for the user
    if (this.aiAssist && this.currentUser?.accountGrade?.promptAssist) {
      // this.aiAssist.bindInputSource(this.questionInput);
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
    }

    this.creditBalanceSignal = (document.querySelector('default-layout') as HTMLElement & { getCreditBalanceSignal: () => IExternalBalanceSignal | null }).getCreditBalanceSignal();
    
    this.creditBalanceSignal?.value$.subscribe(async (value: number | null) => {    
      this.currentBalance = value || 0;

      if(this.currentUser){
        this.currentUser.accountBalance.credits = this.currentBalance;
      }      
    });

    this.autocompleteTriggers.addEventListener('autocomplete:trigger:selected', (event) => {
      const detail = (event as CustomEvent<{ type: string; id: string; title: string }>).detail;
      if(detail.type === 'style'){
        this.selectedStyles.push({ type: detail.type, id: detail.id, title: detail.title });
      } else if(detail.type === 'project'){
        this.selectedProjects.push({ type: detail.type, id: detail.id, title: detail.title });
        // Notify knowledge picker about the selected project
        this.notifyKnowledgePickerOfProjectSelection(detail.id, detail.title);
      }
    });

    // Initialize textarea auto-resize and mirror-textarea listeners
    setTimeout(() => {
      this.autoResizeTextarea();
      this.updateAssistContext();
      this.setupMirrorTextareaListeners();
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

    // Listen for autocomplete state change events
    this.addEventListener('autocomplete:state:change', this.handleAutocompleteStateChange.bind(this));

    // Initialize keyboard shortcuts
    KeyboardShortcutsHelper.initializeShortcuts.bind(this)();

    // Listen for keyboard shortcut events
    this.addEventListener('keyboard:web-search-toggle', this.handleWebSearchToggle.bind(this) as EventListener);
    this.addEventListener('keyboard:advanced-prompts-toggle', this.handleAdvancedPromptsToggle.bind(this) as EventListener);

    // Listen for knowledge picker selection changes
    this.addEventListener('knowledge:selection:changed', this.handleKnowledgeSelectionChanged.bind(this) as EventListener);

    // Set up mirror-textarea signal listeners
    this.setupMirrorTextareaListeners();

    const ev = new CustomEvent('chat-component-connected', {
      detail: true,
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(ev);

    this.currentUser = (document.querySelector('default-layout') as HTMLElement & { getCurrentUser: () => IRWSUser | null }).getCurrentUser();
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

  handleSlotChanges(e: Event) {
      const theEvent = e as CustomEvent<IPromptSlotsContent>;

      this.overrides = {
          ...this.overrides,
          promptSlots: theEvent.detail,
      };
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

    // Remove autocomplete event listener
    this.removeEventListener('autocomplete:state:change', this.handleAutocompleteStateChange.bind(this));

    // Remove keyboard shortcut event listeners
    this.removeEventListener('keyboard:web-search-toggle', this.handleWebSearchToggle.bind(this) as EventListener);
    this.removeEventListener('keyboard:advanced-prompts-toggle', this.handleAdvancedPromptsToggle.bind(this) as EventListener);
    this.removeEventListener('knowledge:selection:changed', this.handleKnowledgeSelectionChanged.bind(this) as EventListener);

    // Clean up mirror-textarea listeners
    this.cleanupMirrorTextareaListeners();

    // Clean up keyboard shortcuts
    KeyboardShortcutsHelper.stopListening();

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

  handleAutocompleteStateChange(event: Event) {
    const customEvent = event as CustomEvent;
    const { isOpen } = customEvent.detail;
    this.enterSubmitBlocked = isOpen;
  }

  handleWebSearchToggle(event: Event) {
    const customEvent = event as CustomEvent;
    const { enabled } = customEvent.detail;
    
    // Provide user feedback about the toggle
    this.dispatchEvent(new CustomEvent('show-notification', {
      detail: { 
        message: `Web Search ${enabled ? 'enabled' : 'disabled'}`,
        type: 'info'
      },
      bubbles: true,
      composed: true
    }));
  }

  handleAdvancedPromptsToggle(event: Event) {
    const customEvent = event as CustomEvent;
    const { enabled } = customEvent.detail;
    
    // Provide user feedback about the toggle
    this.dispatchEvent(new CustomEvent('show-notification', {
      detail: { 
        message: `Advanced Prompts ${enabled ? 'enabled' : 'disabled'}`,
        type: 'info'
      },
      bubbles: true,
      composed: true
    }));
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
    const sanitizedValue = DOMPurify.sanitize(value || '');
    if (this.questionInput && typeof this.questionInput.setValue === 'function') {
      this.questionInput.setValue(sanitizedValue);
      // Trigger auto-resize after setting value
      this.autoResizeTextarea();
    }
    this.currentQuestion = sanitizedValue;
  }

  public setInputValue(value: string, append: boolean = false): void {
    if (this.questionInput) {
      if (typeof this.questionInput.setInputValue === 'function') {
        // Use mirror-textarea's setInputValue method
        this.questionInput.setInputValue(value, append);
      } else if (typeof this.questionInput.setValue === 'function' && typeof this.questionInput.getValue === 'function') {
        // Use mirror-textarea's setValue method
        if (append) {
          const currentValue = this.questionInput.getValue() || '';
          this.questionInput.setValue(currentValue + value);
        } else {
          this.questionInput.setValue(value);
        }
      }
      
      // Trigger auto-resize after setting value
      this.autoResizeTextarea();
    }
    
    if (append) {
      this.currentQuestion += value;
    } else {
      this.currentQuestion = value;
    }
    this.resetInputCheck();
  }

  resetInputCheck() {
    let hasValue = false;
    if (this.questionInput && typeof this.questionInput.getValue === 'function') {
      hasValue = !!this.questionInput.getValue();
    }
    this.isResetInput = hasValue;
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
    // Only update assist context if AI assist is enabled
    if (this.currentUser?.accountGrade?.promptAssist) {
      HandlerHelper.handleDiscussionLLMTurn.bind(this)();
    }
  }

  // New method to trigger AI assist analysis after LLM response
  async triggerAIAssistAfterLLMResponse(): Promise<void> {
    // Only trigger AI assist if the feature is enabled and component is available
    if (this.aiAssist && this.currentUser?.accountGrade?.promptAssist && typeof (this.aiAssist as any).analyzeAfterLLMResponse === 'function') {
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

    // Ensure currentQuestion is synced with the textarea value
    if (this.questionInput && typeof this.questionInput.getValue === 'function') {
      this.currentQuestion = this.questionInput.getValue();
    }

    // Check if user has credits before allowing chat submission
    if (this.currentBalance <= 0) {
      // Emit popup event using the existing appEvents system
      const noCreditsEvent = new CustomEvent('appEvents.popupShow', {
        detail: {
          message: 'chat.noCredits.message',
          type: 'error',
          params: { balance: this.currentBalance }
        },
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(noCreditsEvent);      

      return; // Block chat execution
    }
    
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
    if (this.questionInput && typeof this.questionInput.setValue === 'function') {
      this.questionInput.setValue('');
    }
    this.currentQuestion = '';
    this.isResetInput = false;
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

  handleOnInputChange(e: KeyboardEvent | Event | any): void {
    // Update current question from signal or event
    if (e.value !== undefined) {
      this.currentQuestion = e.value;
    } else if (e.target && (e.target as HTMLInputElement).value !== undefined) {
      this.currentQuestion = (e.target as HTMLInputElement).value;
    }
    
    this.resetInputCheck();

    // Only handle Enter key submission for direct keyboard events, not mirror-textarea events
    // Mirror-textarea events are handled separately in handleMirrorTextareaKeyup
    if (e.key === 'Enter' && !e.shiftKey && !e.shouldSubmit && this.currentQuestion.trim().length > 0) {
      // Block Enter submission if enter submit is blocked (e.g., autocomplete is open)
      if (this.enterSubmitBlocked) {
        return; // Don't submit, let the blocking component handle the Enter key
      }
      
      // Only proceed if this is a real DOM event with preventDefault
      if (typeof e.preventDefault === 'function') {
        this.handleUserChatSubmit(e);
      }
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

    // Use mirror-textarea's built-in autoResize method
    if (typeof this.questionInput.autoResize === 'function') {
      this.questionInput.autoResize();
    } else {
      // Fallback for regular textarea (shouldn't be needed with mirror-textarea)
      this.questionInput.style.height = 'auto';
      const computedStyle = getComputedStyle(this.questionInput);
      const minHeight = parseInt(computedStyle.minHeight) || 40;
      const maxHeight = parseInt(computedStyle.maxHeight) || 120;
      const scrollHeight = this.questionInput.scrollHeight - 10;
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      this.questionInput.style.height = `${newHeight}px`;
      
      if (scrollHeight > maxHeight) {
        this.questionInput.style.overflowY = 'auto';
      } else {
        this.questionInput.style.overflowY = 'hidden';
      }
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

  public getKeyboardShortcuts() {
    return KeyboardShortcutsHelper.getShortcuts();
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
      this.questionInput.setValue(text);
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
        this.questionInput.setValue(text);
        this.currentQuestion = text; // Update the reactive property
        this.questionInput.focus();

        // Trigger input event to update any reactive properties and reset input check
        this.questionInput.dispatchEvent(new Event('input', { bubbles: true }));
        if (this.questionInput && typeof this.questionInput.autoResize === 'function') {
          this.questionInput.autoResize();
        }
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

  removeStyle(event: Event, styleId: string) {
    event.preventDefault();
    event.stopPropagation();
    
    // Remove the style from selectedStyles array
    this.selectedStyles = this.selectedStyles.filter(style => style.id !== styleId);
    
    // Emit custom event to notify about style removal
    const removeStyleEvent = new CustomEvent('chat:remove:style', {
      detail: { styleId },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(removeStyleEvent);
    
    // Force a re-render to update the UI
    this.requestUpdate();
  }

  removeProject(event: Event, projectId: string) {
    event.preventDefault();
    event.stopPropagation();
    
    // Remove the project from selectedProjects array
    this.selectedProjects = this.selectedProjects.filter(project => project.id !== projectId);
    
    // Notify knowledge picker about project removal
    this.notifyKnowledgePickerOfProjectRemoval(projectId);
    
    // Emit custom event to notify about project removal
    const removeProjectEvent = new CustomEvent('chat:remove:project', {
      detail: { projectId },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(removeProjectEvent);
    
    // Force a re-render to update the UI
    this.requestUpdate();
  }

  private notifyKnowledgePickerOfProjectSelection(projectId: string, projectTitle: string) {
    const knowledgePicker = this.shadowRoot?.querySelector('knowledge-picker');
    if (knowledgePicker) {
      // Dispatch event to knowledge picker to select project and load its knowledge
      const event = new CustomEvent('chat:project:selected', {
        detail: { projectId, projectTitle },
        bubbles: true,
        composed: true
      });
      knowledgePicker.dispatchEvent(event);
    }
  }

  private notifyKnowledgePickerOfProjectRemoval(projectId: string) {
    const knowledgePicker = this.shadowRoot?.querySelector('knowledge-picker');
    if (knowledgePicker) {
      // Dispatch event to knowledge picker to remove project
      const event = new CustomEvent('chat:project:removed', {
        detail: { projectId },
        bubbles: true,
        composed: true
      });
      knowledgePicker.dispatchEvent(event);
    }
  }

  private handleKnowledgeSelectionChanged(event: Event) {
    const customEvent = event as CustomEvent<{ selectedIds: string[], selectedKnowledge: any[] }>;
    const { selectedIds } = customEvent.detail;
    
    // Update the selectedKnowledge array with knowledge IDs (not project IDs)
    this.selectedKnowledge = selectedIds || [];        
  }

  handleKnowledgePickerChange(event: CustomEvent) {
    const { selectedIds, selectedKnowledge } = event.detail;
    
    // Update the selectedKnowledge array with knowledge IDs
    this.selectedKnowledge = selectedIds || [];
    
    // Emit custom event for the main chat page to handle knowledge updates
    const kdbPickEvent = new CustomEvent('kdbPick', {
      detail: { selectedIds, selectedKnowledge },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(kdbPickEvent);
    
    // Emit custom event for other components that might need to know about knowledge selection
    const knowledgeChangeEvent = new CustomEvent('knowledge:selection:changed', {
      detail: { selectedIds, selectedKnowledge },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(knowledgeChangeEvent);    
  }

  private mirrorTextareaSignalSubscriptions: any[] = [];

  private setupMirrorTextareaListeners() {
    // Set up SignalService for mirror-textarea communication
    if (typeof window !== 'undefined') {
      // Create or get SignalService instance for mirror-textarea
      if (!(window as any).signalService && typeof (window as any).SignalService !== 'undefined') {
        (window as any).signalService = new (window as any).SignalService();
      }
    }
    
    // Always use event listeners as primary method for Lit component to RWS component communication
    const questionInput = this.querySelector('#question-input') || this.questionInput;
    
    if (questionInput) {
      // Listen for input changes from mirror-textarea
      questionInput.addEventListener('mirror-textarea-input', this.handleMirrorTextareaInput.bind(this));
      
      // Listen for key events from mirror-textarea
      questionInput.addEventListener('mirror-textarea-keyup', this.handleMirrorTextareaKeyup.bind(this));
      
      // Listen for focus events
      questionInput.addEventListener('mirror-textarea-focus', () => {
        // Handle focus if needed
      });
      
      // Listen for blur events
      questionInput.addEventListener('mirror-textarea-blur', () => {
        // Handle blur if needed
      });
      
      // Listen for paste events
      questionInput.addEventListener('mirror-textarea-paste', (event: any) => {
        const data = event.detail;
        if (data && data.clipboardData) {
          this.handlePasteEvent(data.clipboardData);
        }
      });
    }
  }

  private cleanupMirrorTextareaListeners() {
    // Unsubscribe from all signal subscriptions
    this.mirrorTextareaSignalSubscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    this.mirrorTextareaSignalSubscriptions = [];
    
    // Remove event listeners from mirror-textarea
    const questionInput = this.querySelector('#question-input') || this.questionInput;
    
    if (questionInput) {
      questionInput.removeEventListener('mirror-textarea-input', this.handleMirrorTextareaInput.bind(this));
      questionInput.removeEventListener('mirror-textarea-keyup', this.handleMirrorTextareaKeyup.bind(this));
      // Note: We can't remove anonymous function listeners, but they'll be cleaned up when the element is removed
    }
  }

  private handleMirrorTextareaInput(event: Event) {
    const customEvent = event as CustomEvent;
    const data = customEvent.detail;
    if (data) {
      this.handleOnInputChange(data);
    }
  }

  private handleMirrorTextareaKeyup(event: Event) {
    const customEvent = event as CustomEvent;
    const data = customEvent.detail;
    if (data) {
      // Handle Enter key for submission (without shift)
      if (data.key === 'Enter' && !data.shiftKey && data.shouldSubmit) {
        event.preventDefault();
        
        // Always get the latest value from the textarea component to ensure sync
        if (this.questionInput && typeof this.questionInput.getValue === 'function') {
          this.currentQuestion = this.questionInput.getValue();
        } else if (data.value !== undefined) {
          this.currentQuestion = data.value;
        }
        
        // Don't call handleUserChatSubmit directly, instead use the form submission logic
        if (this.currentQuestion.trim().length > 0 && !this.enterSubmitBlocked) {
          // Create a proper event object for form submission that mimics button click behavior
          const syntheticEvent = new Event('submit', {
            bubbles: true,
            cancelable: true
          });
          
          // Override the target to be the form instead of questionInput for consistency
          Object.defineProperty(syntheticEvent, 'target', {
            value: this.querySelector('#chat-form'),
            writable: false
          });
          
          this.handleUserChatSubmit(syntheticEvent);
        }
      } else {
        // Handle other key events for input changes (but don't call submit logic)
        if (data.key !== 'Enter') {
          this.handleOnInputChange(data);
        }
      }
    }
  }

  override render() {
    return RenderHelper.mainRender.bind(this)(globalConfig, teaserListTexts);
  }
}
