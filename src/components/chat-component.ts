/* eslint-disable unicorn/template-indent */
import { LitElement } from 'lit';
import DOMPurify from 'dompurify';
import { customElement, property, query, state } from 'lit/decorators.js';

declare global {
  interface Window {
    rws_currentUser: IRWSUser | null;
  }
}

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
import { KeyboardShortcutsHelper } from '../helpers/KeyboardShortcutsHelper.js';
import { bufferTyping, createCustomTyper, CustomTyper } from '../utils/bufferTyping.js';
import { ChatThreadComponent } from './chat-thread-component.js';

let teaserListTexts = configTeaserListTexts;
let globalConfig = mainConfig;

const DEFAULT_CHAT_SETTINGS: IChatSettings = {
  imageModel: 'stableDiffusionXL',
  videoModel: null,
  voice: null,
  chatLearning: false,
  enableAIAssistant: true,
  temperature: 0.7,
  maxTokens: null,
  extendedContext: false,
  thinking: true
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

  @property({ type: Boolean, attribute: 'data-text-typing', converter: (value) => value === 'true' })
  dynamicTextTyping: Boolean = false;

  @property({
    type: String, attribute: 'data-selected-model', converter: (value) => {
      try {
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    }
  })
  externalSelectedModel: any = null;

  @property({
    type: String, attribute: 'data-selected-avatar', converter: (value) => {
      try {
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    }
  })
  externalSelectedAvatar: any = null;

  @property({ type: String, attribute: 'data-ai-provider' })
  externalAiProvider: string = '';

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

  @property({ type: Boolean, attribute: 'compact', converter: (value) => value === 'true' })
  compact: boolean = false;

  @query('#question-input')
  questionInput!: HTMLTextAreaElement;

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
  isTalking: 0 | 1 | 2 = 0;

  @state()
  upperLoader = false;

  @state()
  currentQuestionHidden = false;

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
  selectedStyles: { type: string; id: string; title: string }[] = [];

  @state()
  selectedProjects: { type: string; id: string; title: string }[] = [];

  @state()
  selectedKnowledge: string[] = [];

  @state()
  fullKnowledgeIds: string[] = [];

  @property({ type: Number, attribute: 'data-convo-id' })
  convoId: number | null = null;

  chatThread: ChatThreadEntry[] = [];

  aiAssistantSignal: IExternalAssistSignal | null = null;
  creditBalanceSignal: IExternalBalanceSignal | null = null;

  private customTyper: CustomTyper | null = null;
  private lastTypingEntryId: string | null = null;
  private typerTarget: HTMLElement | null = null;
  private customTyperDoneCallback: (() => void) | null = null;
  private lastTypedFullText: string = '';
  
  private previousGeneratingAnswer: boolean = false; // Track previous generatingAnswer state

  private deepCloneChatThreadEntry(entry: ChatThreadEntry): ChatThreadEntry {
    if (typeof (globalThis as any).structuredClone === 'function') {
      try {
        return (globalThis as any).structuredClone(entry);
      } catch {
        // fall through to JSON clone
      }
    }
    return JSON.parse(JSON.stringify(entry));
  }

  private handleTyperDone(): void {
    console.log('[handleTyperDone]', { hasCallback: !!this.customTyperDoneCallback });
    if (this.customTyperDoneCallback) {
      const cb = this.customTyperDoneCallback;
      this.customTyperDoneCallback = null;
      cb();
    }
    // Do not reset typing state here; stream end is handled by willUpdate/finalizeTyping.
  }

  private finalizeTyping(finalEntry: ChatThreadEntry): void {
    if (this.lastTypingEntryId === null && !this.customTyper) {
      console.log('[finalizeTyping] already finalized, skipping');
      return;
    }
    console.log('[finalizeTyping]', { id: finalEntry.id, textLength: finalEntry.text?.[0]?.value?.length });
    const threadsComponent = this.shadowRoot?.querySelector('chat-thread-component') as ChatThreadComponent;
    if (threadsComponent) {
      threadsComponent.isTyping = false;
    }
    // Clone the final entry so a later mutation of the controller's processingMessage
    // does not wipe the persisted message in chatThread.
    const finalEntryToStore = this.deepCloneChatThreadEntry(finalEntry);
    const finalIndex = this.chatThread.findIndex((entry) => entry.id === finalEntryToStore.id);
    this.chatThread =
      finalIndex > -1
        ? newListWithEntryAtIndex(this.chatThread, finalIndex, finalEntryToStore)
        : [...this.chatThread, finalEntryToStore];
    this.requestUpdate();
    this.customTyper?.destroy();
    this.customTyper = null;
    this.typerTarget = null;
    this.lastTypingEntryId = null;
    this.customTyperDoneCallback = null;
    this.lastTypedFullText = '';
  }

  /**
   * Clean up dynamic typing state when a stream is cancelled.
   * Preserves any text that was already typed; removes empty placeholders.
   */
  private cleanupDynamicTypingOnCancel(): void {
    const threadsComponent = this.shadowRoot?.querySelector('chat-thread-component') as ChatThreadComponent | null;
    if (threadsComponent) {
      threadsComponent.isTyping = false;
      threadsComponent.showLoadingIndicator = false;
      threadsComponent.requestUpdate();
    }

    if (this.lastTypingEntryId) {
      const idx = this.chatThread.findIndex((entry) => entry?.id === this.lastTypingEntryId);
      if (idx > -1) {
        const entry = this.chatThread[idx];
        if (this.customTyper && entry?.text?.every((t) => !t.value)) {
          const typedText = this.customTyper.getTypedText();
          if (typedText) {
            const updatedEntry = this.deepCloneChatThreadEntry(entry);
            updatedEntry.text = updatedEntry.text.map((t) => ({ ...t, value: typedText }));
            this.chatThread = newListWithEntryAtIndex(this.chatThread, idx, updatedEntry);
          } else {
            this.chatThread = [...this.chatThread.slice(0, idx), ...this.chatThread.slice(idx + 1)];
          }
        }
      }
    }

    this.customTyper?.destroy();
    this.customTyper = null;
    this.typerTarget = null;
    this.lastTypingEntryId = null;
    this.customTyperDoneCallback = null;
    this.lastTypedFullText = '';
    this.previousGeneratingAnswer = false;
  }

  static override styles = [chatStyle];

  private aiAssistInitialized = false;


  override firstUpdated() {
    if (this.autocompleteTriggers) {
      this.autocompleteTriggers.bindTextarea(this.questionInput);
    }

    this.aiAssistCheck();

    this.creditBalanceSignal = (document.querySelector('default-layout') as HTMLElement & { getCreditBalanceSignal: () => IExternalBalanceSignal | null })?.getCreditBalanceSignal();
    console.log('act', this.creditBalanceSignal);

    this.creditBalanceSignal?.value$.subscribe(async (value: number | null) => {
      this.currentBalance = value || 0;

      if (this.currentUser) {
        this.currentUser.accountBalance.credits = this.currentBalance;
      }
    });

    if (this.autocompleteTriggers) {
      this.autocompleteTriggers.addEventListener('autocomplete:trigger:selected', (event) => {
        const detail = (event as CustomEvent<{ type: string; id: string; title: string }>).detail;
        if (detail.type === 'style') {
          this.selectedStyles.push({ type: detail.type, id: detail.id, title: detail.title });
        } else if (detail.type === 'project') {
          this.selectedProjects.push({ type: detail.type, id: detail.id, title: detail.title });
          // Notify knowledge picker about the selected project
          this.notifyKnowledgePickerOfProjectSelection(detail.id, detail.title);
        }
      });
    }

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


    if (!this.aiAssistInitialized && this.aiAssist) {
      this.aiAssistCheck();
      this.aiAssistInitialized = true;
    }

    if (changedProperties.has('chatSettings')) {
      const oldSettings = changedProperties.get('chatSettings') as IChatSettings;
      const newSettings = this.chatSettings;

      // Check if AI Assistant was enabled (changed from disabled/undefined to enabled)
      if (!oldSettings?.enableAIAssistant && newSettings?.enableAIAssistant) {
        this.aiAssistCheck();
      }
    }

    if (changedProperties.has('initialMessages')) {
      if (this.initialMessages.length > 0) {
        // Only overwrite chatThread if there's no current conversation in progress
        // This prevents old messages from overwriting a new conversation
        if (this.chatThread.length === 0 || !this.isChatStarted) {
          this.chatThread = InitMsgHelper.fillInitMessages(this.initialMessages);
          this.isChatStarted = true;
          this.isDefaultPromptsEnabled = false;

          // Update assist context when initial messages are loaded
          this.updateAssistContext();

          // Force a re-render to ensure chat-thread-component gets updated
          this.requestUpdate();
        }
      }
      // Removed the else block that was clearing chatThread when initialMessages was empty
      // Empty initialMessages should not clear an active conversation
    }

    if (changedProperties.has('useWebSocket') || changedProperties.has('websocketEvents')) {
      this.chatController.configureWebSocket(this.useWebSocket, this.websocketEvents);
    }

    // Auto-resize textarea when component layout changes
    if (changedProperties.has('isFullscreen') || changedProperties.has('isAsideOpen')) {
      setTimeout(() => this.autoResizeTextarea(), 100);
    }

    if (changedProperties.has('compact')) {
      if (this.compact) {
        this.chatSettings = DEFAULT_CHAT_SETTINGS;
      }

    }

    // Stream text with custom typer after Lit has rendered the DOM.
    // Only type AI messages; user messages render immediately.
    if (this.dynamicTextTyping && this.chatController.processingMessage && this.chatController.generatingAnswer && !this.chatController.processingMessage.isUserMessage) {
      const threadsComponent = this.shadowRoot?.querySelector('chat-thread-component') as ChatThreadComponent;
      const messageArea = threadsComponent?.shadowRoot?.querySelector(`#typing-target-${this.lastTypingEntryId}`) as HTMLElement;

      if (messageArea) {
        const fullText = this.chatController.processingMessage.text[0]?.value || '';

        console.log('[updated] typing state', { customTyperExists: !!this.customTyper, typerConnected: !!this.typerTarget?.isConnected, lastTypedFullTextLength: this.lastTypedFullText.length, fullTextLength: fullText.length });

        if (!this.customTyper) {
          console.log('[updated] creating new typer');
          messageArea.innerHTML = '';
          this.customTyper = createCustomTyper(messageArea, {
            onDone: () => this.handleTyperDone(),
          });
          this.typerTarget = messageArea;
          this.lastTypedFullText = '';
        } else if (!this.typerTarget?.isConnected) {
          // Lit recreated the element during streaming; re-attach the
          // existing typer to the new DOM node without resetting its state.
          console.log('[updated] reattaching typer');
          this.customTyper.setMessageArea(messageArea);
          this.typerTarget = messageArea;
        }

        if (fullText.length > this.lastTypedFullText.length) {
          const delta = fullText.slice(this.lastTypedFullText.length);
          this.lastTypedFullText = fullText;
          console.log('[updated] typing delta', { delta: JSON.stringify(delta), deltaLength: delta.length, fullTextLength: fullText.length });
          bufferTyping(this.customTyper, delta);
        } else if (fullText.length < this.lastTypedFullText.length) {
          console.warn('[updated] fullText shrank', { old: this.lastTypedFullText.length, new: fullText.length });
        }

        // Keep scroll pinned to bottom while typing
        threadsComponent?.ensureAutoScroll();
      }
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

    // Sync external model data on first load
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

    const ev = new CustomEvent('chat-component-connected', {
      detail: true,
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(ev);

    this.currentUser = window.rws_currentUser || null;
  }

  private aiAssistCheck() {
    console.log(this.aiAssist);
    if (this.aiAssist && this.currentUser?.accountGrade?.promptAssist) {
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
    }
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
    this.questionInput.value = DOMPurify.sanitize(value || '');
    this.currentQuestion = this.questionInput.value;
    this.autoResizeTextarea();
  }

  public setInputValue(value: string, append: boolean = false, send: boolean = false, hidden: boolean = false): void {
    if (hidden) {
      this.currentQuestion = value;
      this.questionInput.value = value; // Also set textarea value for hidden messages
      this.currentQuestionHidden = true;
    } else {
      if (append) {
        const currentValue = this.questionInput.value || '';
        const newValue = currentValue + value;
        this.setQuestionInputValue(newValue);
      } else {
        this.setQuestionInputValue(value);
      }
    }

    this.resetInputCheck();

    console.log({ send });


    if (send) {
      this.handleUserChatSubmit(new Event('submit'));
    }
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
    if (this.chatThread.length === 1 && this.chatThread[0] === undefined) {
      this.chatThread = [];
    }
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

    if (!(this.overrides.avatar || this.overrides.selectedModel)) {
      console.log('No avatar or model in chat overrides');
      return;
    }

    // If currently streaming, cancel the active request before sending new one
    if (this.chatController.generatingAnswer || this.chatController.isProcessingResponse) {
      this.chatController.cancelRequest();
      // Wait briefly for cancellation to process
      await new Promise(resolve => setTimeout(resolve, 100));

      if (this.dynamicTextTyping) {
        this.cleanupDynamicTypingOnCancel();
      }
    }

    this.collapseAside(event);

    // Check if user has credits before allowing chat submission
    if (this.currentUser && this.currentBalance <= 0 && !['super_admin', 'enterprise'].includes(this.currentUser.role)) {
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

  handleOnKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && this.questionInput.value.trim().length > 0) {
      // If balance is 0, always prevent default to stop newlines
      if (this.currentBalance <= 0) {
        e.preventDefault();
        return;
      }

      // If autocomplete is open, prevent default
      if (this.enterSubmitBlocked) {
        e.preventDefault();
        return;
      }

      // Otherwise prevent default since we handle submission on keyup
      e.preventDefault();
    }
  }

  handleOnInputChange(e: KeyboardEvent | Event): void {
    this.resetInputCheck();
    this.autoResizeTextarea();

    if (e instanceof KeyboardEvent && e.key === 'Enter' && !e.shiftKey && this.questionInput.value.trim().length > 0) {
      // Always prevent default Enter behavior since we want Enter to submit, not add newlines
      e.preventDefault();

      // Block Enter submission if enter submit is blocked (e.g., autocomplete is open)
      if (this.enterSubmitBlocked) {
        return; // Don't submit, let the blocking component handle the Enter key
      }

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

    if (this.dynamicTextTyping) {
      this.cleanupDynamicTypingOnCancel();
    }
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
    // Disable input only while awaiting response (before streaming starts)
    this.isDisabled = this.chatController.isAwaitingResponse && !this.chatController.isProcessingResponse;

    if (this.chatController.processingMessage) {
      const processingEntry = this.chatController.processingMessage as ChatThreadEntry;

      if ((this.chatThread.length === 1 && this.chatThread[0] === undefined) || !processingEntry || !processingEntry.id) {
        return;
      }

      const index = this.chatThread.findIndex((entry) => entry.id === processingEntry.id);

      const threadsComponent = this.shadowRoot?.querySelector('chat-thread-component') as ChatThreadComponent;

      // Reset typer state when a new processing message starts.
      // Only create a placeholder while actively generating, otherwise a
      // finished stream could re-enter here after finalizeTyping and spawn
      // a duplicate empty message / second typing pass.
      if (this.dynamicTextTyping && currentGeneratingAnswer && !processingEntry.isUserMessage && processingEntry.id && this.lastTypingEntryId !== processingEntry.id) {
        console.log('[willUpdate] new processing message -> reset typer', { id: processingEntry.id, lastTypingEntryId: this.lastTypingEntryId, customTyperExists: !!this.customTyper });
        // If the previous placeholder is still empty, replace it instead of stacking a new one.
        const prevIndex = this.chatThread.findIndex((entry) => entry.id === this.lastTypingEntryId);
        const prevEntry = prevIndex > -1 ? this.chatThread[prevIndex] : null;
        const prevEmpty = prevEntry && prevEntry.text.every((t) => !t.value);

        this.lastTypingEntryId = processingEntry.id;
        this.customTyper?.destroy();
        this.customTyper = null;
        this.typerTarget = null;
        this.lastTypedFullText = '';

        // Mark thread as typing so it renders an empty container for the typer
        if (threadsComponent) {
          threadsComponent.isTyping = true;
        }

        // Prevent loading-indicator re-renders from replacing the TypeIt target element
        if (threadsComponent && threadsComponent.showLoadingIndicator) {
          threadsComponent.showLoadingIndicator = false;
          threadsComponent.requestUpdate();
        }

        const placeholder = this.deepCloneChatThreadEntry(processingEntry);
        placeholder.text = placeholder.text.map((t) => ({ ...t, value: '' }));

        if (prevIndex > -1 && prevEmpty) {
          this.chatThread = newListWithEntryAtIndex(this.chatThread, prevIndex, placeholder);
        } else {
          this.chatThread = [...this.chatThread, placeholder];
        }
      }

      // User messages always render immediately; AI messages only get added
      // to chatThread here when dynamic typing is disabled (the typer owns
      // the placeholder while streaming).
      if (!this.dynamicTextTyping || processingEntry.isUserMessage) {
        this.chatThread =
          index > -1
            ? newListWithEntryAtIndex(this.chatThread, index, processingEntry)
            : [...this.chatThread, processingEntry];
      }

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

      //DONE TYPING
      if (this.dynamicTextTyping) {
        // Capture the final entry now so later controller mutations don't erase it.
        const finalEntry = this.deepCloneChatThreadEntry(this.chatController.processingMessage as ChatThreadEntry);
        if (this.customTyper && !this.customTyper.isDone()) {
          // Wait for the typer to drain its queue naturally, then finalize.
          this.customTyperDoneCallback = () => this.finalizeTyping(finalEntry);
        } else {
          this.finalizeTyping(finalEntry);
        }
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

  toggleTalk(value: 0 | 1 | 2) {
    this.isTalking = value;
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
    const customEvent = event as CustomEvent<{ selectedIds: string[], fullKnowledgeIds?: string[], selectedKnowledge: any[] }>;
    const { selectedIds, fullKnowledgeIds } = customEvent.detail;

    // Update the selectedKnowledge array with knowledge IDs (not project IDs)
    this.selectedKnowledge = selectedIds || [];
    this.fullKnowledgeIds = fullKnowledgeIds || [];
  }

  handleKnowledgePickerChange(event: CustomEvent) {
    const { selectedIds, fullKnowledgeIds, selectedKnowledge } = event.detail;

    // Update the selectedKnowledge array with knowledge IDs
    this.selectedKnowledge = selectedIds || [];
    this.fullKnowledgeIds = fullKnowledgeIds || [];

    // Emit custom event for the main chat page to handle knowledge updates
    const kdbPickEvent = new CustomEvent('kdbPick', {
      detail: { selectedIds, fullKnowledgeIds, selectedKnowledge },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(kdbPickEvent);

    // Emit custom event for other components that might need to know about knowledge selection
    const knowledgeChangeEvent = new CustomEvent('knowledge:selection:changed', {
      detail: { selectedIds, fullKnowledgeIds, selectedKnowledge },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(knowledgeChangeEvent);
  }

  override render() {
    return RenderHelper.mainRender.bind(this)(globalConfig, teaserListTexts);
  }
}
