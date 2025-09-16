import { css } from 'lit';

export const styles = css`
  .reasoning-container {
    margin: 16px 0;
    border: 1px solid #e3e6f0;
    border-radius: 8px;
    background: #f8f9fc;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .reasoning-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
    user-select: none;
    transition: background 0.3s ease;
  }

  .reasoning-header:hover {
    background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .reasoning-icon {
    width: 20px;
    height: 20px;
    display: inline-block;
  }

  .reasoning-icon::before {
    font-family: 'simple-line-icons';
    font-size: 20px;
    content: '\e0b6'; /* icon-bulb */
  }

  .reasoning-title {
    font-weight: 600;
    font-size: 14px;
    margin: 0;
  }

  .step-counter {
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }

  .toggle-icon {
    width: 16px;
    height: 16px;
    display: inline-block;
    transition: transform 0.3s ease;
  }

  .toggle-icon::before {
    font-family: 'simple-line-icons';
    font-size: 16px;
    content: '\e09b'; /* icon-arrow-down */
  }

  .toggle-icon.collapsed::before {
    content: '\e096'; /* icon-arrow-up */
  }

  .reasoning-content {    
    overflow: hidden;
    transition: max-height 0.3s ease-out;
  }

  .reasoning-content.collapsed {
    max-height: 0;
  }

  .reasoning-steps {
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .reasoning-step {
    padding: 12px 16px;
    border-bottom: 1px solid #e3e6f0;
    position: relative;
  }

  .reasoning-step:last-child {
    border-bottom: none;
  }

  .step-indicator {
    position: absolute;
    left: 16px;
    top: 12px;
    width: 24px;
    height: 24px;
    background: #28a745;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    z-index: 1;
  }

  .step-content {
    margin-left: 40px;
    font-size: 14px;
    line-height: 1.5;
    color: #2d3748;
  }

  .step-content strong {
    color: #1a202c;
    font-weight: 600;
  }

  .step-content code {
    background: #f1f3f4;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
  }

  .step-content em {
    font-style: italic;
    color: #4a5568;
  }

  .reasoning-step:not(:last-child) .step-indicator::after {
    content: '';
    position: absolute;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    width: 2px;
    height: 20px;
    background: #e3e6f0;
    z-index: 0;
  }

  @media (max-width: 768px) {
    .reasoning-container {
      margin: 12px 0;
    }
    
    .reasoning-header {
      padding: 10px 12px;
    }
    
    .reasoning-step {
      padding: 10px 12px;
    }
    
    .step-content {
      margin-left: 32px;
      font-size: 13px;
    }
    
    .step-indicator {
      width: 20px;
      height: 20px;
      font-size: 10px;
    }

    .reasoning-icon::before {
      font-size: 16px;
    }

    .toggle-icon::before {
      font-size: 14px;
    }
  }
`;