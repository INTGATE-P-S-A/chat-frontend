import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { addIconSheet } from '../utils';
import { styles } from '../styles/reasoning-viewer.js';

@customElement('reasoning-viewer')
export class ReasoningViewer extends LitElement {
  @property({ attribute: 'streaming', type: Boolean }) streaming = false;
  @property({ attribute: 'closed', type: Boolean }) closed = false;
  @property({ attribute: 'label', type: String }) label = 'Reasoning';

  @property({ attribute: 'component-id' }) componentId = '';
  @property({ type: String }) reasoningText: string = '';

  @state() dropdownShown = true;

  static override styles = [styles];

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
             ${html`<div class="step-content" .innerHTML="${this.reasoningText}"></div>`}
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