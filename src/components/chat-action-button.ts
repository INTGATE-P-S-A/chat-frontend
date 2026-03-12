import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { styles } from '../styles/chat-action-button.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { addIconSheet } from '../utils/index.js';

export interface ChatActionButton {
  label: string;
  svgIcon: string;
  isDisabled: boolean;
  id: string;
}

@customElement('chat-action-button')
export class ChatActionButtonComponent extends LitElement {
  static override styles = [styles];

  @property({ type: String })
  label = '';

  @property({ type: String })
  svgIcon = '';

  @property({ type: String })
  simpleIcon = '';

  @property({ type: Boolean })
  isDisabled = false;

  @property({ type: Boolean })
  altColor = false;

  @property({ type: String })
  actionId = '';

  @property({ type: String })
  tooltip: string | undefined = undefined;

  override async connectedCallback() {
    super.connectedCallback();
    await addIconSheet.bind(this)();
  }

  override render() {
    return html`
      <button title="${this.label}" class="${this.altColor ? 'alt-color' : ''}" data-testid="${this.actionId}" ?disabled="${this.isDisabled}">
        <span>${this.tooltip ?? this.label}</span>
        ${this.svgIcon ? unsafeSVG(this.svgIcon) : html`<i class="simple-icon-${this.simpleIcon}"></i>`}
      </button>
    `;
  }
}
