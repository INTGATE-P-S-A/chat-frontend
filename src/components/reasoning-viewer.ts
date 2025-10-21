import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { addIconSheet } from '../utils';
import { styles } from '../styles/reasoning-viewer.js';

// Import parser rules for reasoning text
import { HeaderRule } from '../core/parser/rules/header-rule.js';
import { TextFormattingRule } from '../core/parser/rules/text-formatting-rule.js';
import { LineBreakRule } from '../core/parser/rules/line-break-rule.js';

@customElement('reasoning-viewer')
export class ReasoningViewer extends LitElement {
  @property({ attribute: 'streaming', type: Boolean }) streaming = false;
  @property({ attribute: 'closed', type: Boolean }) closed = false;
  @property({ attribute: 'label', type: String }) label = 'Reasoning';

  @property({ attribute: 'component-id' }) componentId = '';
  @property({ type: String }) reasoningText: string = '';

  @state() dropdownShown = true;

  static override styles = [styles];

  /**
   * Parse reasoning text using header and text formatting rules
   * @param text - The raw reasoning text to parse
   * @returns Parsed HTML string
   */
  private parseReasoningText(text: string): string {
    if (!text) {
      return '';
    }

    // Initialize parser rules for reasoning
    const headerRule = new HeaderRule();
    const textFormattingRule = new TextFormattingRule();
    const lineBreakRule = new LineBreakRule();

    let processedText = text;

    // First pass: Apply header formatting using the public processFullText method
    processedText = headerRule.processFullText(processedText);

    // Second pass: Apply text formatting (bold/italic)
    processedText = textFormattingRule.processFullText(processedText);

    // Third pass: Apply line break formatting (converts \n to <br/>)
    processedText = lineBreakRule.processFullText(processedText);

    return processedText;
  }

  override async connectedCallback() {
    super.connectedCallback();

    await addIconSheet.bind(this)();

    if(this.closed){
      this.dropdownShown = false;
    }
  }

  close(){
    // Add a slight delay to make the transition visible
    if (this.dropdownShown) {
      this.dropdownShown = false;
      this.requestUpdate();
    }
  }

  override render() {
    return html`
      <div class="reasoning-container ${this.streaming ? 'streaming' : ''}">
        <div class="reasoning-header" @click="${this.toggleDropdown}">
          <div class="header-content">
            <i class="simple-icon-bulb"></i>
            <h4 class="reasoning-title">${this.label}</h4>          
          </div>
          <i class="simple-icon-arrow-${this.dropdownShown ? 'up' : 'down'}"></i>
        </div>
        
        <div class="reasoning-content ${this.dropdownShown ? '' : 'collapsed'}">
             ${html`<div class="step-content" .innerHTML="${this.parseReasoningText(this.reasoningText)}"></div>`}
        </div>
      </div>
    `;
  }

  private toggleDropdown() {
    this.dropdownShown = !this.dropdownShown;
    this.requestUpdate();
  }

  updateReasoning(text: string) {
    if (text && text.trim()) {      
      // Update the reasoningSteps array immutably to trigger re-render
      this.reasoningText += text;
      this.requestUpdate();
    }
  }

  clearReasoning() {
    this.reasoningText = '';
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reasoning-viewer': ReasoningViewer;
  }
}