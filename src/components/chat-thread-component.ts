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

  override async connectedCallback() {
    super.connectedCallback();

    await addIconSheet.bind(this)();     
    
    // Override config if customConfig is provided
    this.overrideConfig();
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
    
    // Auto-scroll to bottom when new messages are added
    if (changedProperties.has('chatThread') && this.chatThread.length) {
        this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {    
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
    // Get the message at this index and check if it has reasoning
    const message = this.chatThread[messageIndex];
    if (!message || !message.reasoning) return '';

    console.log({currentConfig});
    
    return html`
      <reasoning-viewer
        component-id="${message.id}"
        label="${currentConfig.REASONING_LABEL}"
        .reasoningText="${message.reasoning}"
        .closed="${this.isReasoningClosed}"
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
