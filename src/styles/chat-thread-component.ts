import { css } from 'lit';

export const styles = css`
  :host {
    display: block;
    height: 100%;
    width: 100%;
  }
  
  ul {
    margin-block-start: 0;
    margin-block-end: 0;
  }
  @keyframes chatmessageanimation {
    0% {
      opacity: 0.5;
      top: 150px;
    }
    100% {
      opacity: 1;
      top: 0;
    }
  }
  .chat__header--button {
    display: flex;
    align-items: center;
  }
  .chat__header {
    display: flex;
    align-items: top;
    justify-content: flex-end;
    padding: 0;
  }
  .chat__header--button {
    margin-right: var(--d-base);
  }
  .chat__footer {
    width: 100%;
    height: 0;
  }
  .chat__listItem {
    display: flex;
    margin-bottom: 1rem;
    align-items: flex-end;
    width: 100%;
  }
  .chat__listItem.user-message {
    justify-content: flex-end;
  }
  .chat__listItem:not(.user-message) {
    justify-content: flex-start;
  }
  .chat__txt {
    animation: chatmessageanimation 0.5s ease-in-out;
    background-color: white;
    color: #333;
    border-radius: 1rem;
    margin-top: 8px;
    word-wrap: break-word;
    margin-block-end: 0;
    position: relative;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    border: 1px solid var(--chat_header_color, #e3e6f0);
    border-bottom-left-radius: 0.25rem;
    padding: 0.75rem 1rem;
    max-width: 100%;

    .chat__files {
      display: flex;
      flex-direction: row;
      gap: 10px;
      margin-bottom: 10px;
      flex-wrap: wrap;

      .file-item {
        max-width: 230px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .file-item.non-image-file {
        background: #FFF;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px;
        min-width: 120px;
        max-width: 200px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }

      .file-item__icon {
        font-size: 24px;
        color: #666;
        margin-bottom: 8px;
      }

      .file-item__info {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .file-item__name {
        font-size: 12px;
        font-weight: 500;
        color: #333;
        margin-bottom: 4px;
        word-break: break-word;
        max-width: 100%;
      }

      .file-item__size {
        font-size: 10px;
        color: #888;
      }
    }    

    p + br {
      display: none;
    }

    h1 {
      font-size: 1.5em;
    }

    h2 {
      font-size: 1.3em;
    }

    h3 {
      font-size: 1.1em;
    }

    h1,h2,h3 {      
      & + br {
        display: none;
      }

      & + br + br {
        display: none;
      }
    }

    /* Bootstrap table styles for parsed content */
    .table-responsive {
      margin: 1rem 0;
      border: 1px solid #dee2e6;
      border-radius: 0.375rem;
      overflow-x: auto;

      br {
        display: none;
      }
      
      .table {
        margin-bottom: 0;
        background-color: white;
        border-collapse: collapse;
        width: 100%;
        
        th, td {
          padding: 0.75rem;
          vertical-align: top;
          border-top: 1px solid #dee2e6;
          border-bottom: 1px solid #dee2e6;

          br {
            display: block;
          }
        }
        
        thead th {
          vertical-align: bottom;
          border-bottom: 2px solid #dee2e6;
          background-color: #f8f9fa;
          font-weight: 600;
          border-top: 0;
        }
        
        tbody + tbody {
          border-top: 2px solid #dee2e6;
        }
        
        &.table-striped tbody tr:nth-of-type(odd) {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        &.table-hover tbody tr:hover {
          background-color: rgba(0, 0, 0, 0.075);
        }
        
        &.table-bordered {
          border: 1px solid #dee2e6;
          
          th, td {
            border: 1px solid #dee2e6;
          }
          
          thead th, thead td {
            border-bottom-width: 2px;
          }
        }
        
        &.table-sm th, &.table-sm td {
          padding: 0.3rem;
        }
        
        .thead-dark th {
          color: #fff;
          background-color: #343a40;
          border-color: #454d55;
        }
        
        .thead-light th {
          color: #495057;
          background-color: #e9ecef;
          border-color: #dee2e6;
        }
        
        .badge {
          display: inline-block;
          padding: 0.25em 0.4em;
          font-size: 75%;
          font-weight: 700;
          line-height: 1;
          text-align: center;
          white-space: nowrap;
          vertical-align: baseline;
          border-radius: 0.375rem;
          
          &.badge-success {
            color: #fff;
            background-color: #198754;
          }
          
          &.badge-danger {
            color: #fff;
            background-color: #dc3545;
          }
          
          &.badge-warning {
            color: #000;
            background-color: #ffc107;
          }
          
          &.badge-info {
            color: #fff;
            background-color: #0dcaf0;
          }
          
          &.badge-primary {
            color: #fff;
            background-color: #0d6efd;
          }
          
          &.badge-secondary {
            color: #fff;
            background-color: #6c757d;
          }
        }
        
        .btn {
          display: inline-block;
          padding: 0.375rem 0.75rem;
          margin-bottom: 0;
          font-size: 1rem;
          font-weight: 400;
          line-height: 1.5;
          text-align: center;
          text-decoration: none;
          vertical-align: middle;
          cursor: pointer;
          border: 1px solid transparent;
          border-radius: 0.375rem;
          transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
          
          &.btn-sm {
            padding: 0.25rem 0.5rem;
            font-size: 0.875rem;
            border-radius: 0.25rem;
          }
          
          &.btn-primary {
            color: #fff;
            background-color: #0d6efd;
            border-color: #0d6efd;
            
            &:hover {
              background-color: #0b5ed7;
              border-color: #0a58ca;
            }
          }
          
          &.btn-danger {
            color: #fff;
            background-color: #dc3545;
            border-color: #dc3545;
            
            &:hover {
              background-color: #bb2d3b;
              border-color: #b02a37;
            }
          }
          
          &.btn-success {
            color: #fff;
            background-color: #198754;
            border-color: #198754;
            
            &:hover {
              background-color: #157347;
              border-color: #146c43;
            }
          }
          
          &.btn-warning {
            color: #000;
            background-color: #ffc107;
            border-color: #ffc107;
            
            &:hover {
              background-color: #ffca2c;
              border-color: #ffc720;
            }
          }
          
          &.btn-info {
            color: #000;
            background-color: #0dcaf0;
            border-color: #0dcaf0;
            
            &:hover {
              background-color: #31d2f2;
              border-color: #25cff2;
            }
          }
          
          &.btn-secondary {
            color: #fff;
            background-color: #6c757d;
            border-color: #6c757d;
            
            &:hover {
              background-color: #5c636a;
              border-color: #565e64;
            }
          }
          
          & + .btn {
            margin-left: 0.5rem;
          }
        }
      }
    }
  }

  .search-ref {
    color: var(--primary-color);
    cursor: pointer;
    &:hover{
      text-decoration: underline;
    }
  }
  
  .message-content {
    max-width: 70%;
    display: flex;
    flex-direction: column;
  }
  
  .user-message .message-content {
    align-items: flex-end;
  }
  
  .chat__listItem:not(.user-message) .message-content {
    align-items: flex-start;
  }
  
  .message-avatar {
    margin: 0 0.5rem;
  }
  
  .message-avatar img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }
  
  .ai-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #28a745;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
  }
  .chat__txt loading-indicator {
    position: absolute;
    bottom: 0;
    right: 0;
  }
  .chat__txt.error {
    border: var(--border-base) solid var(--error-color);
    color: var(--error-color);
    padding: var(--d-base);
    background: var(--c-error-background);
  }
  .chat__txt.user-message {
    background: #007bff;
    color: white;
    border: 1px solid #007bff;
    border-bottom-right-radius: 0.25rem;
    border-bottom-left-radius: 1rem;
  }
  .chat__listItem.user-message {
    align-self: flex-end;
  }
  .chat__txt--entry {
    padding: 0;
    margin: 0;
  }

  .chat__txt--entry file-card {
    margin-bottom: 15px;   
    display: block; 
  }
  .chat__txt--info {
    font-size: 0.75rem;
    color: #6c757d;
    margin: 0;
    margin-top: 0.25rem;
  }
  .user-message .chat__txt--info {
    text-align: right;
  }
  .chat__txt--footer {
    display: flex;
    flex-direction: row;
    margin-top: 10px;
  }
  .items__listWrapper {
    border-top: var(--border-thin) solid var(--c-light-gray);
    display: grid;
    padding: 0 var(--d-base);
    grid-template-columns: 1fr 18fr;
  }
  .items__listWrapper svg {
    fill: var(--c-accent-high);
    width: var(--d-large);
    margin: var(--d-large) auto;
  }
  svg {
    height: auto;
    fill: var(--text-color);
  }
  .items__list.followup {
    display: flex;
    flex-direction: row;
    padding: var(--d-base);
    list-style-type: none;
    flex-wrap: wrap;
  }
  .items__list.steps {
    padding: 0 var(--d-base) 0 var(--d-xlarge);
    list-style-type: disc;
  }
  .chat__citations {
    margin-top: 15px;
    border-top: var(--border-thin) solid var(--c-light-gray);
  }
  .items__list {
    margin: var(--d-small) 0;
    display: block;
    padding: 0 var(--d-base);
  }
  .items__listItem--followup {
    cursor: pointer;
    padding: 0 var(--d-xsmall);
    border-radius: var(--radius-base);
    border: var(--border-thin) solid var(--c-accent-high);
    margin: var(--d-xsmall);
    transition: background-color 0.3s ease-in-out;
  }
  .items__listItem--followup:hover,
  .items__listItem--followup:focus {
    background-color: var(--c-accent-light);
    cursor: pointer;
  }
  .items__link {
    text-decoration: none;
    color: var(--text-color);
  }
  .steps .items__listItem--step {
    padding: var(--d-xsmall) 0;
    font-size: var(--font-base);
    line-height: 1;
  }
  .followup .items__link {
    color: var(--c-accent-high);
    display: block;
    padding: var(--d-xsmall) 0;
    border-bottom: var(--border-thin) solid var(--c-light-gray);
    font-size: var(--font-small);
  }
  .citation {
    background-color: var(--c-accent-light);
    border-radius: 3px;
    padding: calc(var(--d-small) / 5);
    margin-left: 3px;
  }

  .tool-entry {
    margin: var(--d-base) 0;
    padding: 10px;
    background-color: var(--c-light-gray);
    border-radius: var(--radius-base);
    box-shadow: var(--shadow);
    border: var(--border-thin) solid var(--c-accent-light);
  }

  .tool-name {
    font-weight: bold;
    color: var(--c-accent-dark);
    margin-bottom: var(--d-small);
  }

  .tool-info {
    font-size: var(--font-small);
    color: var(--text-color);
  }

  .web-search-info {
        
  }

  .web-search-info strong {
    display: block;
    font-weight: bold;
    color: #3a3a3a;
    margin-bottom: var(--d-small);
  }

  .web-search-result {
    font-size: var(--font-small);
    color: var(--text-color);
    margin-bottom: var(--d-small);
  }
  .speech-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-left: var(--d-xsmall);

    svg {
      width: 20px;
      height: 20px;
      fill: var(--c-accent-dark); 
    }
  }
  #chat__thread-container {    
    margin: 0;
    border: 1px solid var(--chat_header_color, #e3e6f0);
    border-radius: 0.35rem;
    background: #f8f9fc;
    height: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }  
  .chat-topic {    
    padding: 1rem;
    border-bottom: 1px solid var(--chat_header_color, #e3e6f0);
    background: #f8f9fc;
    border-radius: 0.35rem 0.35rem 0 0;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 1rem;
  }  
  .chat-topic h5 {  
    margin: 0;
    font-size: 1.1rem;
    color: #000;
    margin-right: 1rem;
  }

  .chat-topic .talking-indicator {
    display: flex;
    flex-direction: row;
    gap: 10px;
    margin-left: 15px;
    border-radius: 15px;
    border: 1px solid var(--alt_blu);
    color: var(--alt_blu);
    background-color: #FFF;
    padding: 5px;
    

    &.talking {
      animation: pulse-opacity 1.5s ease-in-out infinite;
    }    
  }

  @keyframes pulse-opacity {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
    100% {
      opacity: 1;
    }
  }  

  /* Fullscreen toggle button styles */
  .fullscreen-toggle-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 2px solid var(--primary-color);
    background-color: var(--primary-color);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease-in-out;
    padding: 5px;
    flex-shrink: 0;
    margin-left: auto;
  }

  .fullscreen-toggle-btn:hover {
    opacity: 0.8;
    transform: scale(1.05);
  }

  .fullscreen-toggle-btn:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .fullscreen-toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .chat__list {
    color: var(--text-color);
    display: flex;
    flex-direction: column;
    list-style-position: inside;
    padding-inline-start: 0;    
    padding: 1rem;
    flex: 1;
    overflow-y: auto;
    background: white;
  }

  .cost-info {
    font-size: 0.75rem;
    color: #666;    
    opacity: 0.8;
  }

  .chat__txt--info {
    display: flex;
    align-items: center;
  }

  .timestamp {
    font-size: 0.75rem;
    color: #999;
    margin-right: 0.5rem;
  }

  .model-info {
    margin-left: 0.5rem;
  }

  .share-link {
    color: #73236b;
    text-decoration: none;
  }

  .file-item.is-userborn {
    .file-item__actions {
      position: absolute;
      left: 20px;
      top: 35px;
    }
  }

  p.from-rag{
      border-top: 3px solid #F00;
      position: relative;
      padding-top: 25px;

      &::after{
        background-color: #FFF;
        border-radius: 5px;
        content: 'RAG';
        position: absolute;
        top: -15px;
        right: 10px;
        padding: 3px;
        border: 1px solid #F00;
    }      
  }

  p.from-ai-network{
    border-top: 3px solid #0F0;
    position: relative;
    padding-top: 25px;

    &::after{
      background-color: #FFF;
      border-radius: 5px;
      content: 'AI';
      position: absolute;
      top: -15px;
      right: 10px;
      padding: 3px;
      border: 1px solid #0F0;
    }
  }

  
`;
