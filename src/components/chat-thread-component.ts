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
import { ReasoningViewer } from './reasoning-viewer.js';

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

  @property({ type: String })
  conversationTitle;

  @property({ type: Boolean })
  isFullscreen = false;

  @state()
  isResponseCopied = false;

  @state()
  isReasoningClosed = false;

  @state()
  reasoningTexts: { [key: string]: string } = {};

  @state()
  currentReasoningId: string | null = null;

  @state()
  pendingReasoningId: string | null = null; // Track reasoning waiting for an AI message

  @state()
  messageReasoningMap: { [messageIndex: number]: string } = {};

  @query('#chat-list-footer')
  chatFooter!: HTMLElement;

  private previousChatThreadLength = 0;

  override async connectedCallback() {
    super.connectedCallback();

    await addIconSheet.bind(this)();     
  }

  override willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties);
    
    // Check if a new AI message was added and we have pending reasoning
    if (changedProperties.has('chatThread') && this.pendingReasoningId) {
      const newAIMessageIndex = this.findLatestAIMessageIndex();
      
      // Check if there's a new AI message OR if the latest AI message doesn't have reasoning yet
      const shouldAssociate = newAIMessageIndex >= 0 && (
        newAIMessageIndex >= this.previousChatThreadLength || 
        !this.messageReasoningMap[newAIMessageIndex]
      );
      
      if (shouldAssociate) {
        this.messageReasoningMap = {
          ...this.messageReasoningMap,
          [newAIMessageIndex]: this.pendingReasoningId
        };
        this.pendingReasoningId = null; // Clear pending reasoning
      }
    }

    // Auto-scroll to bottom when new messages are added
    if (changedProperties.has('chatThread') && this.chatThread.length) {
        this.scrollToBottom();
    }
    
    this.previousChatThreadLength = this.chatThread.length;
  }

  private scrollToBottom(): void {    
    const scrollContainer = this.shadowRoot?.querySelector('#chat__thread-container ul.chat__list');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  private findLatestAIMessageIndex(): number {
    for (let i = this.chatThread.length - 1; i >= 0; i--) {
      if (!this.chatThread[i].isUserMessage) {
        const reasoningComponent = this.shadowRoot?.querySelector('reasoning-viewer') as ReasoningViewer;
        
        if(reasoningComponent && reasoningComponent.dropdownShown){
          this.isReasoningClosed = true;
          reasoningComponent.close();
        }    
        return i;
      }
    }
    return -1;
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

  // debounce dispatching must-scroll event
  debounceScrollIntoView(): void {
    let timeout: any = 0;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (this.chatFooter) {
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

  // Reasoning management methods
  addReasoningStep(reasoningId: string, step: string) {
    if (!this.reasoningTexts[reasoningId]) {
      this.reasoningTexts[reasoningId] = '';
    }

    console.log({step})

    // Append the new text chunk to existing text
    this.reasoningTexts = {
      ...this.reasoningTexts,
      [reasoningId]: this.reasoningTexts[reasoningId] + step
    };
    
    // Set the current reasoning ID for the latest message
    this.currentReasoningId = reasoningId;
    
    // Find the last AI message (non-user message) to associate reasoning with
    let targetMessageIndex = -1;
    for (let i = this.chatThread.length - 1; i >= 0; i--) {
      if (!this.chatThread[i].isUserMessage) {
        targetMessageIndex = i;
        break;
      }
    }
    
    if (targetMessageIndex >= 0) {
      // AI message exists (either real or placeholder) - associate reasoning immediately
      this.messageReasoningMap = {
        ...this.messageReasoningMap,
        [targetMessageIndex]: reasoningId
      };
      // Clear any pending reasoning since we found an AI message to associate with
      this.pendingReasoningId = null;
    } else {
      // No AI message exists yet - store reasoning as pending
      // It will be associated when the streaming process creates the AI message
      this.pendingReasoningId = reasoningId;
    }
    
    this.requestUpdate();
  }

  getReasoningText(reasoningId: string): string {
    return this.reasoningTexts[reasoningId] || '';
  }

  clearReasoningText(reasoningId: string) {
    const newTexts = { ...this.reasoningTexts };
    delete newTexts[reasoningId];
    this.reasoningTexts = newTexts;
    
    // Clear current reasoning ID if it matches
    if (this.currentReasoningId === reasoningId) {
      this.currentReasoningId = null;
    }
    
    // Remove from message mapping
    const newMapping = { ...this.messageReasoningMap };
    Object.keys(newMapping).forEach(key => {
      if (newMapping[parseInt(key)] === reasoningId) {
        delete newMapping[parseInt(key)];
      }
    });
    this.messageReasoningMap = newMapping;
    
    this.requestUpdate();
  }

  // Method to clear current reasoning when starting a new message
  startNewMessage() {
    // Don't clear the reasoning ID immediately - let it persist until the message is complete
    // this.currentReasoningId = null;
    this.requestUpdate();
  }

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
            .label="${globalConfig.COPY_RESPONSE_BUTTON_LABEL_TEXT}"
            .svgIcon="${this.isResponseCopied ? iconSuccess : iconCopyToClipboard}"
            .isDisabled="${this.isDisabled}"
            actionId="copy-to-clipboard"
            .tooltip="${this.isResponseCopied
        ? globalConfig.COPIED_SUCCESSFULLY_MESSAGE
        : globalConfig.COPY_RESPONSE_BUTTON_LABEL_TEXT}"
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

  renderCitation(entry: ChatThreadEntry) {
    const citations = entry.citations;
    if (citations && citations.length > 0) {
      return html`
        <div class="chat__citations">
          <citation-list
            .citations="${citations}"
            .label="${globalConfig.CITATIONS_LABEL}"
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
    // Check if this message has reasoning associated with it
    const reasoningId = this.messageReasoningMap[messageIndex];
    
    if (reasoningId && this.reasoningTexts[reasoningId]) {
      return html`
        <reasoning-viewer
          component-id="${reasoningId}"
          .reasoningText="${this.reasoningTexts[reasoningId]}"
          .closed="${this.isReasoningClosed}"
        ></reasoning-viewer>
      `;
    }
    return '';
  }

  renderPendingReasoning() {
    // Show pending reasoning if there are reasoning steps but no AI message yet
    if (this.pendingReasoningId && this.reasoningTexts[this.pendingReasoningId]) {
      return html`
        <li class="chat__listItem ai-message">
          <div class="message-avatar">
            <div class="ai-avatar">AI</div>
          </div>
          
          <div class="message-content">
            <div class="chat__txt">
              <reasoning-viewer
                component-id="${this.pendingReasoningId}"
                .reasoningText="${this.reasoningTexts[this.pendingReasoningId]}"
              ></reasoning-viewer>
              <loading-indicator label=""></loading-indicator>
            </div>
          </div>
        </li>
      `;
    }
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
    if (!entry.cost || entry.isUserMessage) {
      return '';
    }

    const { prompt_tokens, completion_tokens, total_tokens, cost } = entry.cost;
    
    return html`
      <span class="cost-info" title="Tokens: ${prompt_tokens} + ${completion_tokens} = ${total_tokens}">
        💰 $${cost.toFixed(4)}
      </span>
    `;
  }

  override render() {
    return html`
    <div id="chat__thread-container">
      <div class="chat-topic">
        <h5>
          ${this.conversationTitle}
        </h5>
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
