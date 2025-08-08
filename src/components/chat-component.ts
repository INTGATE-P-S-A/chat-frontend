/* eslint-disable unicorn/template-indent */
import { LitElement, html } from 'lit';
import DOMPurify from 'dompurify';
import { customElement, property, query, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import {
  chatHttpOptions,
  globalConfig as mainConfig,
  teaserListTexts as configTeaserListTexts,
  requestOptions,
  MAX_CHAT_HISTORY,
} from '../config/global-config.js';
import { chatStyle } from '../styles/chat-component.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { chatEntryToString, newListWithEntryAtIndex, addIconSheet } from '../utils/index.js';

// TODO: allow host applications to customize these icons

import iconLightBulb from '../svg/lightbulb-icon.svg?raw';
import iconDelete from '../svg/delete-icon.svg?raw';
import iconCancel from '../svg/cancel-icon.svg?raw';
import iconSend from '../svg/send-icon.svg?raw';
import iconClose from '../svg/close-icon.svg?raw';
import iconLogo from '../svg/branding/brand-logo.svg?raw';
import iconUp from '../svg/chevron-up-icon.svg?raw';
import megaphoneSvg from '../svg/megaphone.svg?raw';
import downloadSvg from '../svg/download.svg?raw';

// import only necessary components to reduce bundle size
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

import { type TabContent } from './tab-component.js';
import { ChatController } from './chat-controller.js';
import { ChatHistoryController } from './chat-history-controller.js';
import { parseFullMessage } from '../core/parser/bufferer.js';
import { parseTool } from '../core/parser/toolsParser.js';

let teaserListTexts = configTeaserListTexts;
let globalConfig = mainConfig;

/**
 * A chat component that allows the user to ask questions and get answers from an API.
 * The component also displays default prompts that the user can click on to ask a question.
 * The component is built as a custom element that extends LitElement.
 *
 * Labels and other aspects are configurable via properties that get their values from the global config file.
 * @element chat-component
 * @fires chat-component#questionSubmitted - Fired when the user submits a question
 * @fires chat-component#defaultQuestionClicked - Fired when the user clicks on a default question
 * */

@customElement('chat-component')
export class ChatComponent extends LitElement {
  //--
  // Public attributes
  // -

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

  @property({ type: Boolean, attribute: 'data-hide-history', converter: (value) => value === 'true' })
  hideHistory: Boolean = false;

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

  @property({ type: Boolean, attribute: 'data-deep-search', converter: (value) => value === 'true' })
  dataDeepSearch: boolean = false;

  @query('#question-input')
  questionInput!: HTMLInputElement;

  // Default prompts to display in the chat
  @state()
  isDisabled = false;

  @state()
  isChatStarted = false;

  @state()
  isResetInput = false;

  @state()
  useWebSearch = false;

  @state()
  useDeepSearch = false;

  private chatController = new ChatController(this);
  private chatHistoryController = new ChatHistoryController(this);

  // Is showing thought process panel
  @state()
  showCode: { code: string, id: string, language: string } | null = null;

  @state()
  isDefaultPromptsEnabled: boolean = globalConfig.IS_DEFAULT_PROMPTS_ENABLED && !this.isChatStarted;

  @state()
  selectedCitation: Citation | undefined = undefined;

  @state()
  selectedChatEntry: ChatThreadEntry | undefined = undefined;

  // Progress tracking state
  @state()
  isShowingProgress = false;

  @state()
  progressPercentage = 0;

  @state()
  progressMessage = '';

  @state()
  progressStage = '';

  selectedAsideTab: 'tab-thought-process' | 'tab-support-context' | 'tab-citations' = 'tab-thought-process';

  // These are the chat bubbles that will be displayed in the chat
  chatThread: ChatThreadEntry[] = [];

  static override styles = [chatStyle];

  override updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    // The following block is only necessary when you want to override the component from settings in the outside.
    // Remove this block when not needed, considering that updated() is a LitElement lifecycle method
    // that may be used by other components if you update this code.

    this.overrideConfig();

    if (changedProperties.has('customStyles')) {
      this.style.setProperty('--c-accent-high', this.customStyles.AccentHigh);
      this.style.setProperty('--c-accent-lighter', this.customStyles.AccentLight);
      this.style.setProperty('--c-accent-dark', this.customStyles.AccentDark);
      this.style.setProperty('--c-text-color', this.customStyles.TextColor);
      this.style.setProperty('--c-light-gray', this.customStyles.BackgroundColor);
      this.style.setProperty('--c-dark-gray', this.customStyles.ForegroundColor);
      this.style.setProperty('--c-base-gray', this.customStyles.FormBackgroundColor);
      this.style.setProperty('--radius-base', this.customStyles.BorderRadius);
      this.style.setProperty('--border-base', this.customStyles.BorderWidth);
      this.style.setProperty('--font-base', this.customStyles.FontBaseSize);
    }

    // Handle initial messages from external source
    if (changedProperties.has('initialMessages') && this.initialMessages.length > 0) {
      this.chatThread = [];
      this.chatThread = this.initialMessages.map((message) => {
        let i = 0;
        for (const msgTxt of message.text) {
          message.text[i].value = parseFullMessage(msgTxt.value);
          i++;
        }

        if (message.tools) {
          for (const tool of message.tools) {
            message.text[message.text.length - 1].value = parseTool({ name: tool.toolName, data: tool.data }) + message.text[message.text.length - 1].value
          }

        }

        return message;
      });

      this.isChatStarted = true;
      this.isDefaultPromptsEnabled = false;
    } else {
      // this.chatThread = [];
      // this.isDefaultPromptsEnabled = true;
      // this.isChatStarted = false;
    }

    // Configure WebSocket if enabled
    if (changedProperties.has('useWebSocket') || changedProperties.has('websocketEvents')) {
      this.chatController.configureWebSocket(this.useWebSocket, this.websocketEvents);
    }
  }

  override async connectedCallback() {
    super.connectedCallback();

    await addIconSheet.bind(this)();

    if (this.dataWebSearch === true) {
      this.useWebSearch = true;
    }

    if (this.dataDeepSearch === true) {
      this.useDeepSearch = true;
    }

    // Add progress event listeners
    this.addEventListener('chat:progress', this.handleProgressEvent.bind(this) as EventListener);

    this.addEventListener('code:show', (event) => {
      const theEvent: CustomEvent<{code: string, id: string, language: string}> = event as CustomEvent<{code: string, id: string, language: string}>;      
      
      if(this.showCode && this.showCode.id === theEvent.detail.id){
        this.collapseAside(event);
        return
      }

      this.handleExpandAside(event, theEvent.detail);
    });

    this.overrideConfig();

    const ev = new CustomEvent('chat-component-connected', {
      detail: true,
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(ev);
  }

  /**
   * Handle progress events from the parser
   */
  private handleProgressEvent(event: Event) {
    const customEvent = event as CustomEvent;
    const { stage, message, percentage } = customEvent.detail;

    this.progressStage = stage || '';
    this.progressMessage = message || '';
    this.progressPercentage = percentage || 0;
    this.isShowingProgress = true;

    // Hide progress when complete
    if (percentage >= 100 || stage === 'complete') {
      setTimeout(() => {
        this.isShowingProgress = false;
        this.progressPercentage = 0;
        this.progressMessage = '';
        this.progressStage = '';
      }, 1000); // Keep visible for 1 second after completion
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
    this.chatThread = [];
    this.isChatStarted = false;
    this.isDefaultPromptsEnabled = true;
    this.resetCurrentChat(new Event('clear-chat'), true);
  }

  setQuestionInputValue(value: string): void {
    this.questionInput.value = DOMPurify.sanitize(value || '');
    this.currentQuestion = this.questionInput.value;
  }

  /**
   * Public method to set input field value from external sources
   * Can be called via DOM query: document.querySelector('chat-component').setInputValue('text')
   * @param value - The text to set or append to the input field
   * @param append - If true, appends to existing value; if false, replaces the value (default: false)
   */
  public setInputValue(value: string, append: boolean = false): void {
    if (append) {
      const currentValue = this.questionInput.value || '';
      const newValue = currentValue + value;
      this.setQuestionInputValue(newValue);
    } else {
      this.setQuestionInputValue(value);
    }
    this.handleOnInputChange();
  }

  handleVoiceInput(event: CustomEvent): void {
    event?.preventDefault();
    this.setQuestionInputValue(event?.detail?.input);
  }

  handleRecordingStateChange(event: CustomEvent): void {
    event?.preventDefault();
    const { isRecording } = event.detail;

    // Dispatch recording state change event for external listeners
    const recordingStateEvent = new CustomEvent('recording-state-change', {
      detail: { isRecording },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(recordingStateEvent);
  }

  handleQuestionInputClick(event: CustomEvent): void {
    event?.preventDefault();
    this.setQuestionInputValue(event?.detail?.question);
  }

  handleCitationClick(event: CustomEvent): void {
    event?.preventDefault();
    this.selectedCitation = event?.detail?.citation;

    if (!this.showCode) {
      if (event?.detail?.chatThreadEntry) {
        this.selectedChatEntry = event?.detail?.chatThreadEntry;
      }
      this.handleExpandAside();
      this.selectedAsideTab = 'tab-citations';
    }
  }

  handleWebSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.useWebSearch = target.checked;

    this.dispatchEvent(new CustomEvent('websearch-change', {
      detail: { checked: this.useWebSearch },
      bubbles: true,
      composed: true
    }));
  }

  handleDeepSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.useDeepSearch = target.checked;

    this.dispatchEvent(new CustomEvent('deepsearch-change', {
      detail: { checked: this.useDeepSearch },
      bubbles: true,
      composed: true
    }));
  }

  getMessageContext(): Message[] {
    if (this.interactionModel === 'ask') {
      return [];
    }

    const history = [
      ...this.chatThread,
      // include the history from the previous session if the user has enabled the chat history
      ...(this.chatHistoryController.showChatHistory ? this.chatHistoryController.chatHistory : []),
    ];

    const messages: Message[] = history.map((entry) => {
      return {
        content: chatEntryToString(entry),
        role: entry.isUserMessage ? 'user' : 'assistant',
      };
    });

    return messages;
  }

  // Handle the click on the chat button and send the question to the API
  async handleUserChatSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.collapseAside(event);
    const question = DOMPurify.sanitize(this.questionInput.value);
    this.isChatStarted = true;
    this.isDefaultPromptsEnabled = false;

    await this.chatController.generateAnswer(
      {
        ...requestOptions,
        overrides: {
          ...requestOptions.overrides,
          ...this.overrides,
        },
        question,
        type: this.interactionModel,
        messages: this.getMessageContext(),
        useWebSearch: this.useWebSearch,
        useDeepSearch: this.useDeepSearch,
      },
      {
        // use defaults
        ...chatHttpOptions,

        // override if the user has provided different values
        url: this.apiUrl,
        stream: this.useStream,
        headers: this.customHeaders,
      },
      this.useWebSocket, // Pass WebSocket flag
      this.apiUrl // Pass WebSocket URL (same as API URL)
    );

    if (this.interactionModel === 'chat') {
      this.chatHistoryController.saveChatHistory(this.chatThread);
    }

    this.questionInput.value = '';
    this.isResetInput = false;
  }

  // Reset the input field and the current question
  resetInputField(event: Event): void {
    event.preventDefault();
    this.questionInput.value = '';
    this.currentQuestion = '';
    this.isResetInput = false;
  }

  // Reset the chat and show the default prompts
  resetCurrentChat(event: Event, forced = false): void {
    this.isChatStarted = false;
    this.chatThread = [];
    this.isDisabled = false;
    this.isDefaultPromptsEnabled = true;
    this.selectedCitation = undefined;
    this.chatController.reset();
    // clean up the current session content from the history too
    this.chatHistoryController.saveChatHistory(this.chatThread);
    this.collapseAside(event);
    this.handleUserChatCancel(event);

    if (!forced) {
      const resetEvent = new CustomEvent('chat:conversation:end', {
        detail: true,
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(resetEvent);
    }
  }

  // setConvo(id: string | null){
  //   this.overrides = {...this.overrides, conversationId: id};
  // }

  // Show the default prompts when enabled
  showDefaultPrompts(event: Event): void {
    if (!this.isDefaultPromptsEnabled) {
      this.resetCurrentChat(event);
    }
  }

  // Handle the change event on the input field
  handleOnInputChange(): void {
    this.isResetInput = !!this.questionInput.value;
  }

  // Stop generation
  handleUserChatCancel(event: Event): any {
    event?.preventDefault();
    this.chatController.cancelRequest();
  }

  // show thought process aside
  handleExpandAside(event: Event | undefined = undefined, code: { id: string, code: string, language: string } | null = null): void {
    event?.preventDefault();
    this.showCode = code;
    console.log(this.showCode);
    this.selectedAsideTab = 'tab-thought-process';
    this.shadowRoot?.querySelector('#overlay')?.classList.add('active');
    this.shadowRoot?.querySelector('#chat__containerWrapper')?.classList.add('aside-open');
  }

  // hide thought process aside
  collapseAside(event: Event): void {
    event.preventDefault();
    this.showCode = null;
    this.selectedCitation = undefined;
    this.shadowRoot?.querySelector('#chat__containerWrapper')?.classList.remove('aside-open');
    this.shadowRoot?.querySelector('#overlay')?.classList.remove('active');
  }

  renderChatOrCancelButton() {
    const submitChatButton = html`<button
      class="chatbox__button chatbox_submit"
      data-testid="submit-question-button"
      @click="${this.handleUserChatSubmit}"
      title="${globalConfig.CHAT_BUTTON_LABEL_TEXT}"
      ?disabled="${this.isDisabled}"
    >
      <i class="simple-icon-paper-plane"></i>
    </button>`;
    const cancelChatButton = html`<button
      class="chatbox__button"
      data-testid="cancel-question-button"
      @click="${this.handleUserChatCancel}"
      title="${globalConfig.CHAT_CANCEL_BUTTON_LABEL_TEXT}"
    >
      <i class="simple-icon-close"></i>
    </button>`;

    return this.chatController.isProcessingResponse ? cancelChatButton : submitChatButton;
  }

  renderChatEntryTabContent(entry: ChatThreadEntry) {
    return html` <tab-component
      .tabs="${[
        {
          id: 'tab-thought-process',
          label: globalConfig.THOUGHT_PROCESS_LABEL,
        },
        {
          id: 'tab-support-context',
          label: globalConfig.SUPPORT_CONTEXT_LABEL,
        },
        {
          id: 'tab-citations',
          label: globalConfig.CITATIONS_TAB_LABEL,
        },
      ] as TabContent[]}"
      .selectedTabId="${this.selectedAsideTab}"
    >
      <div slot="tab-thought-process" class="tab-component__content">
        ${entry && entry.thoughts ? html` <p class="tab-component__paragraph">${unsafeHTML(entry.thoughts)}</p> ` : ''}
      </div>
      <div slot="tab-support-context" class="tab-component__content">
        ${entry && entry.dataPoints
        ? html` <teaser-list-component
              .alwaysRow="${true}"
              .teasers="${entry.dataPoints.map((d) => {
          return { description: d };
        })}"
            ></teaser-list-component>`
        : ''}
      </div>
      ${entry && entry.citations
        ? html`
            <div slot="tab-citations" class="tab-component__content">
              <citation-list
                .citations="${entry.citations}"
                .label="${globalConfig.CITATIONS_LABEL}"
                .selectedCitation="${this.selectedCitation}"
                @on-citation-click="${this.handleCitationClick}"
              ></citation-list>
              ${this.selectedCitation
            ? html`<document-previewer
                    url="${this.apiUrl}/content/${this.selectedCitation.text}"
                  ></document-previewer>`
            : ''}
            </div>
          `
        : ''}
    </tab-component>`;
  }

  handleChatEntryActionButtonClick(event: CustomEvent) {
    if (event.detail?.id === 'chat-show-thought-process') {
      this.selectedChatEntry = event.detail?.chatThreadEntry;
      this.handleExpandAside(event);
    }

    if (event.detail?.id === 'speak') {
      this.selectedChatEntry = event.detail?.chatThreadEntry;
      this.speak(event, this.selectedChatEntry as ChatThreadEntry);
    }

    if (event.detail?.id === 'download-speech') {
      this.selectedChatEntry = event.detail?.chatThreadEntry;
      this.speak(event, this.selectedChatEntry as ChatThreadEntry, true);
    }
  }

  override willUpdate(): void {
    this.isDisabled = this.chatController.generatingAnswer;

    if (this.chatController.processingMessage) {
      const processingEntry = this.chatController.processingMessage as ChatThreadEntry;
      const index = this.chatThread.findIndex((entry) => entry.id === processingEntry.id);

      this.chatThread =
        index > -1
          ? newListWithEntryAtIndex(this.chatThread, index, processingEntry)
          : [...this.chatThread, processingEntry];
    }
  }

  private speak(event: Event, message: ChatThreadEntry, download = false) {
    event.preventDefault();

    const speakEvent = new CustomEvent(download ? 'chat:download' : 'chat:speak', {
      detail: {
        message: message.text.map((textEntry) => textEntry.value).join(' '),
      },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(speakEvent);
  }

  /**
   * Debug method to check slot content - can be called from browser console
   */
  public debugSlotContent() {
    console.log('=== LIT COMPONENT SLOT DEBUG METHOD ===');

    const modelSelectSlot = this.shadowRoot?.querySelector('slot[name="model_select"]');
    console.log('Model select slot:', modelSelectSlot);

    if (modelSelectSlot) {
      const slot = modelSelectSlot as HTMLSlotElement;
      console.log('Slot innerHTML:', slot.innerHTML);
      console.log('Slot textContent:', slot.textContent);
      console.log('Assigned nodes:', slot.assignedNodes());
      console.log('Assigned elements:', slot.assignedElements());

      // Check if there are any nodes with slot="model_select" in the light DOM
      const lightDOMSlotContent = this.querySelector('[slot="model_select"]');
      console.log('Light DOM slot content:', lightDOMSlotContent);
    }

    // Check all slots
    const allSlots = this.shadowRoot?.querySelectorAll('slot');
    console.log('All slots:', allSlots);

    // Check light DOM content
    console.log('Light DOM innerHTML:', this.innerHTML);
    console.log('All slotted content:', this.querySelectorAll('[slot]'));

    console.log('=== END DEBUG METHOD ===');

    return {
      modelSelectSlot,
      allSlots,
      lightDOMContent: this.innerHTML,
      shadowDOMContent: this.shadowRoot?.innerHTML
    };
  }

  renderChatThread(chatThread: ChatThreadEntry[]) {
    return html`<chat-thread-component
      .chatThread="${chatThread}"
      .conversationTitle="${this.overrides.conversationTitle}"
      .actionButtons="${[
        // {
        //   id: 'chat-show-thought-process',
        //   label: globalConfig.SHOW_THOUGH_PROCESS_BUTTON_LABEL_TEXT,
        //   svgIcon: iconLightBulb,
        //   isDisabled: this.isShowingThoughtProcess,
        // },
        {
          id: 'speak',
          label: globalConfig.SPEAK_BUTTON_LABEL_TEXT,
          svgIcon: megaphoneSvg,
          isDisabled: false,
        },
        {
          id: 'download-speech',
          label: globalConfig.DOWNLOAD_SPEECH_BUTTON_LABEL_TEXT,
          svgIcon: downloadSvg,
          isDisabled: false,
        },
      ] as any}"
      .isDisabled="${this.isDisabled}"
      .isProcessingResponse="${this.chatController.isProcessingResponse}"
      .selectedCitation="${this.selectedCitation}"
      .isCustomBranding="${this.isCustomBranding}"
      .svgIcon="${iconLogo}"
      @on-action-button-click="${this.handleChatEntryActionButtonClick}"
      @on-citation-click="${this.handleCitationClick}"
      @on-followup-click="${this.handleQuestionInputClick}"
    >
    </chat-thread-component>`;
  }

  // Render the chat component as a web component
  override render() {
    return html`
      <div id="overlay" class="overlay"></div>
      <section id="chat__containerWrapper" class="chat__containerWrapper">      
      <div id="chat__title"></div>
        ${this.isCustomBranding && !this.isChatStarted
        ? html` <chat-stage
              svgIcon="${iconLogo}"
              pagetitle="${globalConfig.BRANDING_HEADLINE}"
              url="${globalConfig.BRANDING_URL}"
            >
            </chat-stage>`
        : ''}
        <section class="chat__container" id="chat-container">
          ${this.isChatStarted
        ? html`
                <div class="chat__header--thread">                 
                  ${!this.hideHistory && this.interactionModel === 'chat'
            ? this.chatHistoryController.renderHistoryButton({ disabled: this.isDisabled })
            : ''}                 
                </div>
                ${this.chatHistoryController.showChatHistory
            ? html`<div class="chat-history__container">
                      ${this.renderChatThread(this.chatHistoryController.chatHistory)}
                      <div class="chat-history__footer">
                        ${unsafeSVG(iconUp)}
                        ${globalConfig.CHAT_HISTORY_FOOTER_TEXT.replace(
              globalConfig.CHAT_MAX_COUNT_TAG,
              MAX_CHAT_HISTORY,
            )}
                        ${unsafeSVG(iconUp)}
                      </div>
                    </div>`
            : ''}
                ${this.renderChatThread(this.chatThread)}
              `
        : ''}
          ${this.chatController.isAwaitingResponse
        ? this.isShowingProgress
          ? html`<progress-bar 
                  .progress="${this.progressPercentage}"
                  .message="${this.progressMessage}"
                  .stage="${this.progressStage}">
                </progress-bar>`
          : html`<loading-indicator label="${globalConfig.LOADING_INDICATOR_TEXT}"></loading-indicator>`
        : ''}
          ${!this.chatController.isAwaitingResponse && this.isShowingProgress
        ? html`<progress-bar 
                .progress="${this.progressPercentage}"
                .message="${this.progressMessage}"
                .stage="${this.progressStage}">
              </progress-bar>`
        : ''}
       
         
           
            ${this.isDefaultPromptsEnabled
        ? html`<div class="chat__container">
                  <teaser-list-component
                    .heading="${this.interactionModel === 'chat'
            ? teaserListTexts.HEADING_CHAT
            : teaserListTexts.HEADING_ASK}"
                    .clickable="${true}"
                    .actionLabel="${teaserListTexts.TEASER_CTA_LABEL}"
                    @teaser-click="${this.handleQuestionInputClick}"
                    .teasers="${teaserListTexts.DEFAULT_PROMPTS}"
                  ></teaser-list-component>
                </div>`
        : ''}
        
          <form
            id="chat-form"
            class="form__container ${this.inputPosition === 'sticky' ? 'form__container-sticky' : ''}"
          >
            <div class="chatbox__container">
              <div class="chatbox__input-container">
                <input
                  class="chatbox__input"
                  data-testid="question-input"
                  id="question-input"
                  placeholder="${globalConfig.CHAT_INPUT_PLACEHOLDER}"
                  aria-labelledby="chatbox-label"
                  name="chatbox"
                  type="text"
                  ?disabled="${this.isDisabled}"
                  autocomplete="off"
                  @keyup="${this.handleOnInputChange}"
                />
                <div class="input-group-append">
                  ${this.isResetInput ? html`<button
                    title="${globalConfig.RESET_BUTTON_TITLE_TEXT}"
                    class="chatbox__button btn-outline-danger chat-reset${this.isChatStarted ? ' started' : ''}"
                    type="reset"
                    id="resetBtn"
                    @click="${this.resetInputField}"
                  >
                    <i class="simple-icon-ban"></i>
                  </button>` : ''}
                  ${this.renderChatOrCancelButton()}
                  ${this.isResetInput ? '' : html`<voice-input-button @on-voice-input="${this.handleVoiceInput}" class="chatbox__button btn-outline-secondary" />`}
                  ${!this.hideDeleteButton && this.isChatStarted ? html`<button
                        class="chatbox__button btn-outline-danger"
                        .label="${globalConfig.RESET_CHAT_BUTTON_TITLE}"
                        actionId="chat-reset-button"
                        @click="${this.resetCurrentChat}"
                        title="${globalConfig.RESET_CHAT_BUTTON_TITLE}"
                      >
                        ${unsafeSVG(iconDelete)}
                  </button>` : ''}
                </div>
              </div>
              
            </div>

            ${globalConfig.WEB_SEARCH_CHECKBOX_ENABLED
        ? html`<div class="web-search__wrapper">
                  <div class="web-search__container">
                    <input
                      type="checkbox"
                      class="web-search__checkbox"
                      id="web-search-checkbox"
                      .checked="${this.useWebSearch}"
                      @change="${this.handleWebSearchChange}"
                      ?disabled="${this.isDisabled}"
                    />
                    <label class="web-search__label" for="web-search-checkbox">
                      ${globalConfig.WEB_SEARCH_CHECKBOX_LABEL}
                    </label>
                  </div>
                  ${globalConfig.DEEP_SEARCH_CHECKBOX_ENABLED && this.useWebSearch
            ? html`<div class="web-search__container">
                        <input
                          type="checkbox"
                          class="web-search__checkbox"
                          id="deep-search-checkbox"
                          .checked="${this.useDeepSearch}"
                          @change="${this.handleDeepSearchChange}"
                          ?disabled="${this.isDisabled}"
                        />
                        <label class="web-search__label" for="deep-search-checkbox">
                          ${globalConfig.DEEP_SEARCH_CHECKBOX_LABEL}
                        </label>
                      </div>`
            : ''}
                </div>`
        : ''}

            ${this.isDefaultPromptsEnabled
        ? ''
        : ''}
          </form>
        </section>        
        ${this.showCode?.id
        ? html`
              <aside class="aside" data-testid="aside-thought-process">
                <code-screen language="${this.showCode.language}" componentId=${this.showCode.id}>${this.showCode.code}</code-screen>
              </aside>
            `
        : ''}
      </section>
    `;
  }
}
