import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { styles } from '../styles/voice-input-button.js';
import { globalConfig } from '../config/global-config.js';

import { addIconSheet } from '../utils/index.js';

@customElement('voice-input-button')
export class VoiceInputButton extends LitElement {
  static override styles = [styles];  

  @state()
  showVoiceInput = true;

  @state()
  enableVoiceListening = false;

  override async connectedCallback() {
    super.connectedCallback();

    await addIconSheet.bind(this)();
  }

  handleVoiceInput(event: Event): void {
    event.preventDefault();
    
    this.enableVoiceListening = !this.enableVoiceListening;

    const recordingEvent = new CustomEvent('chat:audio:record', {
      detail: {
        isRecording: this.enableVoiceListening,
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(recordingEvent);
  }

  renderVoiceButton() {
    return html`
      <button
        title="${this.enableVoiceListening
          ? globalConfig.CHAT_VOICE_REC_BUTTON_LABEL_TEXT
          : globalConfig.CHAT_VOICE_BUTTON_LABEL_TEXT}"
        class="${this.enableVoiceListening ? 'recording' : 'not-recording'}"
        @click="${this.handleVoiceInput}"
      >
        ${this.enableVoiceListening ? html`<i class="simple-icon-microphone"></i><i class="simple-icon-close"></i>` : html`<i class="simple-icon-microphone"></i>`}
      </button>
    `;
  }

  override render() {
    return this.showVoiceInput ? this.renderVoiceButton() : html``;
  }
}
