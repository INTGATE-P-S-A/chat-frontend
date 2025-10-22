import { LitElement, html, PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

import { styles } from '../styles/chat-thread-component.js';

import { globalConfig } from '../config/global-config.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { addIconSheet, chatEntryToString } from '../utils/index.js';

import iconSuccess from '../svg/success-icon.svg?raw';
import iconCopyToClipboard from '../svg/copy-icon.svg?raw';
import iconQuestion from '../svg/bubblequestion-icon.svg?raw';

import './citation-list.js';
import './chat-action-button.js';
import './loading-indicator.js';
import './reasoning-viewer.js';
import { type ChatActionButton } from './chat-action-button.js';

let currentConfig = globalConfig;

@customElement('chat-thread-component')
export class ChatThreadComponent extends LitElement {
  static override styles = [styles];

  @property({ type: Array })
  chatThread: ChatThreadEntry[] = [];

  @property({ type: Array })
  actionButtons: ChatActionButton[] = [];

  @property({ type: Boolean })
  isDisabled = false;

  @property({ type: Boolean })
  isProcessingResponse = false;

  @property({ type: Boolean })
  showInitialMessagesReasoningClosed = true;

  @property({ type: String })
  conversationTitle;

  @property({ type: Boolean })
  isFullscreen = false;

  @property({ type: Object })
  customConfig: Record<string, string> = {};

  @state()
  isResponseCopied = false;

  @state()
  isReasoningClosed = false;

  @query('#chat-list-footer')
  chatFooter!: HTMLElement;

  @property({ type: Boolean })
  private isTalking = false;

  @property({ type: Boolean })
  private upperLoader = false;

  @state()
  private isUserScrolledUp = false;

  private scrollTimeout: any = null;

  override async connectedCallback() {
    super.connectedCallback();

    await addIconSheet.bind(this)();     
    
    // Override config if customConfig is provided
    this.overrideConfig();
    
    // Set up scroll listener after component is rendered
    this.updateComplete.then(() => {
      this.setupScrollListener();
    });

    // Listen for code-viewer close others events
    this.addEventListener('code-viewer:close-others', this.handleCloseOtherCodeViewers.bind(this) as EventListener);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeScrollListener();
    
    // Remove code-viewer event listener
    this.removeEventListener('code-viewer:close-others', this.handleCloseOtherCodeViewers.bind(this) as EventListener);
  }

  private setupScrollListener(): void {
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', this.handleScroll.bind(this));
      
      // Initialize scroll state based on current position
      const threshold = 10;
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < threshold;
      this.isUserScrolledUp = !isAtBottom;
    }
  }

  private removeScrollListener(): void {
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', this.handleScroll.bind(this));
    }
  }

  private handleScroll(event: Event): void {
    const scrollContainer = event.target as HTMLElement;
    const threshold = 10;
    
    const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < threshold;
    
    // Clear any pending scroll timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    // During streaming, immediately detect if user scrolls up
    if (this.isProcessingResponse && !isAtBottom) {
      this.isUserScrolledUp = true;
      return;
    }
    
    // Set a timeout for non-streaming scenarios or when user scrolls to bottom
    this.scrollTimeout = setTimeout(() => {
      this.isUserScrolledUp = !isAtBottom;
    }, 100);
  }

  private overrideConfig() {
    if (this.customConfig && Object.keys(this.customConfig).length > 0) {
      currentConfig = { ...globalConfig, ...this.customConfig };
    } else {
      currentConfig = globalConfig;
    }
  }

  override willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);
    
    // Override config if customConfig changes
    if (changedProperties.has('customConfig')) {
      this.overrideConfig();
    }
    
    // Handle chat thread changes
    if (changedProperties.has('chatThread') && this.chatThread.length) {
      const oldChatThread = changedProperties.get('chatThread') as ChatThreadEntry[] || [];
      const hasNewMessage = this.chatThread.length > oldChatThread.length;
      
      // Only reset scroll state when a completely new message is added (new turn in conversation)
      // Don't reset during streaming updates of existing messages
      if (hasNewMessage && !this.isProcessingResponse) {
        this.isUserScrolledUp = false;
      }
      
      // Only auto-scroll if user hasn't manually scrolled up
      if (!this.isUserScrolledUp) {
        this.scrollToBottom();
      }
    }
    
    // When processing starts, don't reset scroll state, just try to scroll if allowed
    if (changedProperties.has('isProcessingResponse')) {
      if (this.isProcessingResponse && !this.isUserScrolledUp) {
        setTimeout(() => this.scrollToBottom(), 10);
      }
    }
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    
    // Scroll after DOM updates if we're processing a response
    if (this.isProcessingResponse && !this.isUserScrolledUp) {
      this.scrollToBottom();
    }
    
    // Also scroll when chat thread changes during processing
    if (changedProperties.has('chatThread') && this.isProcessingResponse && !this.isUserScrolledUp) {
      setTimeout(() => this.scrollToBottom(), 5);
    }
  }

  public scrollToBottom(forced = false): void {
    // Only auto-scroll if user hasn't manually scrolled up
    if (this.isUserScrolledUp && !forced) {
      return;
    }
    
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  /**
   * Reset the scroll state to allow auto-scrolling again
   * Should be called when starting a new conversation turn (new user message)
   */
  public resetScrollState(): void {
    this.isUserScrolledUp = false;
    // Immediately scroll to bottom to ensure we're positioned correctly
    setTimeout(() => {
      const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }, 10);
  }

  /**
   * Call this when a new user message is sent to reset auto-scroll behavior
   */
  public onNewUserMessage(): void {
    this.isUserScrolledUp = false;
  }

  /**
   * Ensure auto-scrolling is working properly for streaming
   */
  public ensureAutoScroll(): void {
    if (!this.isUserScrolledUp) {
      this.scrollToBottom();
    }
  }

  /**
   * Debug method to check scroll state - can be called from browser console
   */
  public debugScrollState() {
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      const threshold = 10;
      const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < threshold;
      
      return {
        isUserScrolledUp: this.isUserScrolledUp,
        isAtBottom,
        scrollHeight: scrollContainer.scrollHeight,
        scrollTop: scrollContainer.scrollTop,
        clientHeight: scrollContainer.clientHeight,
        distanceFromBottom: scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight,
        isProcessingResponse: this.isProcessingResponse
      };
    }
    return null;
  }

  /**
   * Force scroll to bottom regardless of user scroll state
   * Can be called when explicitly wanting to scroll to bottom
   */
  public forceScrollToBottom(): void {
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  @property({ type: Object })
  selectedCitation: Citation | undefined = undefined;

  // Copy response to clipboard
  copyResponseToClipboard(entry: ChatThreadEntry): void {
    const response = chatEntryToString(entry);    
    navigator.clipboard.writeText(response);
    this.isResponseCopied = true;
  }

  actionButtonClicked(actionButton: ChatActionButton, entry: ChatThreadEntry, event: Event) {
    event.preventDefault();

    const actionButtonClickedEvent = new CustomEvent('on-action-button-click', {
      detail: {
        id: actionButton.id,
        chatThreadEntry: entry,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(actionButtonClickedEvent);
  }

  private handleCloseOtherCodeViewers(event: Event): void {
    const customEvent = event as CustomEvent;
    const excludeId = customEvent.detail.excludeId;
    
    // Find all code-viewer components in the shadow DOM and close them (except the excluded one)
    const codeViewers = this.shadowRoot?.querySelectorAll('code-viewer');
    codeViewers?.forEach(viewer => {
      const viewerId = viewer.getAttribute('componentId');
      if (viewerId !== excludeId && (viewer as any).isCodeVisible) {
        (viewer as any).hideCode();
      }
    });
  }

  // debounce dispatching must-scroll event
  debounceScrollIntoView(): void {
    // Only auto-scroll if user hasn't manually scrolled up
    if (this.isUserScrolledUp) {
      return;
    }
    
    let timeout: any = 0;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (this.chatFooter && !this.isUserScrolledUp) {
        this.chatFooter.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);
  }

  handleFollowupQuestionClick(question: string, entry: ChatThreadEntry, event: Event) {
    event.preventDefault();
    const followUpClickEvent = new CustomEvent('on-followup-click', {
      detail: {
        question,
        chatThreadEntry: entry,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(followUpClickEvent);
  }

  handleFullscreenToggle(event: Event) {
    event.preventDefault();
    const fullscreenToggleEvent = new CustomEvent('on-fullscreen-toggle', {
      detail: {
        isFullscreen: !this.isFullscreen,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(fullscreenToggleEvent);
  }

  handleCitationClick(citation: Citation, entry: ChatThreadEntry, event: Event) {
    event.preventDefault();
    this.selectedCitation = citation;
    const citationClickEvent = new CustomEvent('on-citation-click', {
      detail: {
        citation,
        chatThreadEntry: entry,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(citationClickEvent);
  }

  // Copy response to clipboard
  renderResponseActions(entry: ChatThreadEntry) {
    return html`
      <header class="chat__header">
        <div class="chat__header--button">
          ${this.actionButtons.map(
            (actionButton) => html`
                <chat-action-button
                  .label="${actionButton.label}"
                  .svgIcon="${actionButton.svgIcon}"
                  .isDisabled="${actionButton.isDisabled}"
                  .actionId="${actionButton.id}"
                  @click="${(event) => this.actionButtonClicked(actionButton, entry, event)}"
                ></chat-action-button>
              `,
          )}
          <chat-action-button
            .label="${currentConfig.COPY_RESPONSE_BUTTON_LABEL_TEXT}"
            .svgIcon="${this.isResponseCopied ? iconSuccess : iconCopyToClipboard}"
            .isDisabled="${this.isDisabled}"
            actionId="copy-to-clipboard"
            .tooltip="${this.isResponseCopied
        ? currentConfig.COPIED_SUCCESSFULLY_MESSAGE
        : currentConfig.COPY_RESPONSE_BUTTON_LABEL_TEXT}"
            @click="${() => this.copyResponseToClipboard(entry)}"
          ></chat-action-button>
        </div>
      </header>
    `;
  }

  renderTextEntry(textEntry: ChatMessageText) {
    const entries = [html`<p class="chat__txt--entry">${unsafeHTML(textEntry.value)}</p>`];
    
    // render steps
    if (textEntry.followingSteps && textEntry.followingSteps.length > 0) {
      entries.push(html`
        <ol class="items__list steps">
          ${textEntry.followingSteps.map(
        (followingStep) => html` <li class="items__listItem--step">${unsafeHTML(followingStep)}</li> `,
      )}
        </ol>
      `);
    }
    if (this.isProcessingResponse) {
      this.debounceScrollIntoView();
    }
    return html`<div class="chat_txt--entry-container">${entries}</div>`;
  }

  renderFiles(entry: ChatThreadEntry) {
    if (!entry.files || entry.files.length === 0) {
      return '';
    }

    const imageFiles = entry.files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      return '';
    }

    return html`
      <div class="chat__files">
        ${imageFiles.map(file => {
          if (file.tmp) {
            // For temporary files (newly sent), use base64 content
            return html`
              <div class="file-item">
                <gen-image 
                  tmp="true"
                  imageFormat="${file.type.split('/')[1] || 'png'}"
                >${file.base64}</gen-image>
              </div>
            `;
          } else {
            // For persisted files (from data-initial-messages), use fileId
            return html`
              <div class="file-item">
                <gen-image 
                  fileId="${(file as any).id}"
                  imageFormat="${file.type.split('/')[1] || 'png'}"
                ></gen-image>
              </div>
            `;
          }
        })}
      </div>
    `;
  }

  renderCitation(entry: ChatThreadEntry) {
    const citations = entry.citations;
    if (citations && citations.length > 0) {
      return html`
        <div class="chat__citations">
          <citation-list
            .citations="${citations}"
            .label="${currentConfig.CITATIONS_LABEL}"
            .selectedCitation=${this.selectedCitation}
            @on-citation-click="${(event: CustomEvent) =>
          this.handleCitationClick(event.detail.citation, entry, event)}"
          ></citation-list>
        </div>
      `;
    }

    return '';
  }

  renderFollowupQuestions(entry: ChatThreadEntry) {
    const followupQuestions = entry.followupQuestions;
    // render followup questions
    // need to fix first after decoupling of teaserlist
    if (followupQuestions && followupQuestions.length > 0) {
      return html`
        <div class="items__listWrapper">
          ${unsafeSVG(iconQuestion)}
          <ul class="items__list followup">
            ${followupQuestions.map(
        (followupQuestion) => html`
                <li class="items__listItem--followup">
                  <a
                    class="items__link"
                    href="#"
                    data-testid="followUpQuestion"
                    @click="${(event) => this.handleFollowupQuestionClick(followupQuestion, entry, event)}"
                    >${followupQuestion}</a
                  >
                </li>
              `,
      )}
          </ul>
        </div>
      `;
    }

    return '';
  }  

  renderError(error: { message: string }) {
    return html`<p class="chat__txt error">${error.message}</p>`;
  }

  renderReasoningViewer(messageIndex: number) {
    // Get the message at this index and check if it has reasoning or thoughts
    const message = this.chatThread[messageIndex];
    
    if (!message || (!message.reasoning && !message.thoughts)) {
      return '';
    }
    
    // Use reasoning if available, otherwise use thoughts
    const reasoningText = message.reasoning || message.thoughts;
    
    // For initial messages (loaded from backend), they should be closed by default
    // if showInitialMessagesReasoningClosed is true
    // During active processing, use the global isReasoningClosed setting
    const shouldBeClosed = this.isProcessingResponse ? this.isReasoningClosed : this.showInitialMessagesReasoningClosed;
    
    return html`
      <reasoning-viewer
        component-id="${message.id}"
        label="${currentConfig.REASONING_LABEL}"
        .reasoningText="${reasoningText || ''}"
        .closed="${shouldBeClosed}"
      ></reasoning-viewer>
    `;
  }

  renderPendingReasoning() {
    // No longer needed since we create messages immediately when reasoning starts
    return '';
  }

  private formatTo24Hour(timestamp: number): string
  {    
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  private renderCostInfo(entry: ChatThreadEntry) {
    if (entry.isUserMessage) {
      return '';
    }

    // Handle both single cost and costs array formats
    let costData: IPromptCost | null = null;
    
    if (entry.cost) {
      costData = entry.cost;
    } else if (entry.costs && entry.costs.length > 0) {
      // If we have multiple costs, sum them up or take the first one
      if (entry.costs.length === 1) {
        costData = entry.costs[0];
      } else {
        // Sum up all costs
        costData = entry.costs.reduce((total, current) => ({
          prompt_tokens: total.prompt_tokens + current.prompt_tokens,
          completion_tokens: total.completion_tokens + current.completion_tokens,
          total_tokens: total.total_tokens + current.total_tokens,
          cost: total.cost + current.cost,
          reasoning_tokens: (total.reasoning_tokens || 0) + (current.reasoning_tokens || 0)
        }));
      }
    }

    if (!costData) {
      return '';
    }

    const { prompt_tokens, completion_tokens, total_tokens, cost } = costData;
    
    return html`
      <span class="cost-info" title="Tokens: ${prompt_tokens} + ${completion_tokens} = ${total_tokens}">
        💰 $${cost.toFixed(4)}
      </span>
    `;
  }

  private renderModelInfo(entry: ChatThreadEntry) {
    if (entry.isUserMessage || !entry.model) {
      return '';
    }

    return html`
      <span class="model-info" title="AI Model: ${entry.model}">
        🤖 ${entry.model}
      </span>
    `;
  }

  override render() {
    return html`
    <div id="chat__thread-container">
      <div class="chat-topic">
        <h5 class="mr-3">
          ${this.conversationTitle}
        </h5>
        ${ this.isTalking ? html`<div class="talking-indicator"><i class="simple-icon-earphones-alt" /></div>` : '' }
        ${ this.upperLoader ? html`<loading-indicator></loading-indicator>` : '' }
        <button 
            type="button"
            class="fullscreen-toggle-btn ${this.isFullscreen ? 'simple-icon-close' : 'simple-icon-size-fullscreen'}"
            @click="${this.handleFullscreenToggle}"
            title="${this.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}"
            ?disabled="${this.isDisabled}"
        ></button>
      </div>
      <ul class="chat__list" aria-live="assertive">
        ${this.chatThread.map(
          (message, index) => {
            const isLastMessage = index === this.chatThread.length - 1;
            const showLoadingIndicator = this.isProcessingResponse && isLastMessage && !message.isUserMessage;

            return html`
                <li class="chat__listItem ${message.isUserMessage ? 'user-message' : 'ai-message'}">
                  ${!message.isUserMessage ? html`
                    <div class="message-avatar">
                      <div class="ai-avatar">AI</div>
                    </div>
                  ` : ''}
                  
                  <div class="message-content">
                    <div class="chat__txt ${message.isUserMessage ? 'user-message' : ''}">
                      ${!message.isUserMessage ? this.renderReasoningViewer(index) : ''}
                      ${this.renderFiles(message)}
                      ${message.text.map((textEntry) => this.renderTextEntry(textEntry))}                      
                      ${this.renderCitation(message)}
                      ${this.renderFollowupQuestions(message)} 
                      ${message.error ? this.renderError(message.error) : ''}
                      ${showLoadingIndicator ? html`<loading-indicator label=""></loading-indicator>` : ''}
                    </div>
                    <div class="chat__txt--footer">
                      <div class="chat__txt--info">                              
                        <span class="timestamp">${this.formatTo24Hour(message.timestamp)}</span>                        
                        ${this.renderCostInfo(message)}
                        ${this.renderModelInfo(message)}     
                      </div>
                      <div class="chat__response-actions">                  
                        ${message.isUserMessage ? '' : this.renderResponseActions(message)}                                              
                      </div>
                    </div>
                  </div>
                  
                  ${message.isUserMessage ? html`
                    <div class="message-avatar">
                      <img src="/assets/images/avatar.jpg" alt="User" style="width: 32px; height: 32px; border-radius: 50%;">
                    </div>
                  ` : ''}
                </li>
              `},
          )}
        ${this.renderPendingReasoning()}
        </ul>
      </div>
      <div class="chat__footer" id="chat-list-footer">
        <!-- Do not delete this element. It is used for auto-scrolling -->
      </div>
    `;
  }
}
