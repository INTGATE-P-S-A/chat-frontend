import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('gen-image')
export class GenImage extends LitElement {
  static override styles = css`
    :host {
      display: block;
      margin: 0.5rem 0;
    }

    .gen-image-container {
      position: relative;
      max-width: 100%;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .gen-image {
      width: 100%;
      height: auto;
      max-width: 500px;
      display: block;
    }

    .loading {
      padding: 1rem;
      text-align: center;
      color: #666;
    }

    .error {
      padding: 1rem;
      background: #fee;
      color: #c33;
      border-radius: 4px;
    }

    .image-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .gen-image-container:hover .image-actions {
      opacity: 1;
    }

    .action-button {
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border: none;
      padding: 6px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .action-button:hover {
      background: rgba(0, 0, 0, 0.9);
    }
  `;

  @property({ type: String, attribute: 'file-id' })
  fileId!: string;

  @state()
  private loading = true;

  @state()
  private error = '';

  @state()
  private imageUrl = '';

  override async connectedCallback() {
    super.connectedCallback();
    await this.loadImage();
  }

  private async loadImage() {
    if (!this.fileId) {
      this.error = 'No file ID provided';
      this.loading = false;
      return;
    }

    try {
      this.loading = true;
      this.error = '';
      
      // Construct the image URL - assuming there's a file endpoint
      this.imageUrl = `/api/file/${this.fileId}`;
      this.loading = false;
    } catch (error) {
      console.error('Error loading image:', error);
      this.error = 'Failed to load image';
      this.loading = false;
    }
  }

  private handleDownload() {
    if (!this.imageUrl) return;

    try {
      const link = document.createElement('a');
      link.href = this.imageUrl;
      link.download = `image-${this.fileId}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  }

  private async handleCopyToClipboard() {
    if (!this.imageUrl) return;

    try {
      const response = await fetch(this.imageUrl);
      const blob = await response.blob();
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      console.log('Image copied to clipboard');
    } catch (error) {
      console.error('Error copying image to clipboard:', error);
    }
  }

  override render() {
    if (this.loading) {
      return html`<div class="loading">Loading image...</div>`;
    }

    if (this.error) {
      return html`<div class="error">${this.error}</div>`;
    }

    return html`
      <div class="gen-image-container">
        <img 
          class="gen-image" 
          src="${this.imageUrl}" 
          alt="Generated or uploaded image"
          @error="${() => { this.error = 'Failed to load image'; }}"
        />
        <div class="image-actions">
          <button 
            class="action-button" 
            @click="${this.handleCopyToClipboard}"
            title="Copy to clipboard"
          >
            📋
          </button>
          <button 
            class="action-button" 
            @click="${this.handleDownload}"
            title="Download"
          >
            ⬇️
          </button>
        </div>
      </div>
    `;
  }
}