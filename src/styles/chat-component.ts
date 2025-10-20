import { css } from 'lit';

export const chatStyle = css`
  :host {
    --c-primary: #123f58;
    --c-secondary: #f5f5f5;
    --c-text: var(--c-primary);
    --c-white: #fff;
    --c-black: #111111;
    --c-red: #ff0000;
    --c-light-gray: #e3e3e3;
    --c-base-gray: var(--c-secondary);
    --c-dark-gray: #4e5288;
    --c-accent-high: #692b61;
    --c-accent-dark: #5e3c7d;
    --c-accent-light: #f6d5f2;
    --c-error: #8a0000;
    --c-error-background: rgb(253, 231, 233);
    --c-success: #26b32b;
    --font-r-small: 1vw;
    --font-r-base: 3vw;
    --font-r-large: 5vw;
    --font-base: 14px;
    --font-rel-base: 1.2rem;
    --font-small: small;
    --font-large: large;
    --font-larger: x-large;
    --border-base: 3px;
    --border-thin: 1px;
    --border-thicker: 8px;
    --radius-small: 5px;
    --radius-base: 10px;
    --radius-large: 25px;
    --radius-none: 0;
    --width-wide: 90%;
    --width-base: 80%;
    --width-narrow: 50%;
    --d-base: 20px;
    --d-small: 10px;
    --d-xsmall: 5px;
    --d-large: 30px;
    --d-xlarge: 50px;
    --shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    width: 100%;
    height: 100%;
    max-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: var(--d-base);
    color: var(--c-text);
    overflow: hidden;
    box-sizing: border-box;
  }
  :host([data-theme='dark']) {
    --c-primary: #fdfeff;
    --c-secondary: #32343e;
    --c-text: var(--c-primary);
    --c-white: var(--c-secondary);
    --c-black: var(--c-primary);
    --c-red: #ff0000;
    --c-light-gray: #636d9c;
    --c-dark-gray: #e3e3e3;
    --c-base-gray: var(--c-secondary);
    --c-accent-high: #dcdef8;
    --c-accent-dark: var(--c-primary);
    --c-accent-light: #032219;
    --c-error: #8a0000;
    --c-error-background: rgb(253, 231, 233);
    --c-success: #26b32b;
  }
  html {
    scroll-behavior: smooth;
  }
  ul {
    margin-block-start: 0;
    margin-block-end: 0;
  }
  .button {
    color: var(--c-text);
    border: 0;
    background: none;
    cursor: pointer;
    text-decoration: underline;
  }
  .overlay {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    width: 100%;
    height: 0;
    background: var(--c-black);
    z-index: 2;
    opacity: 0.8;
    transition: all 0.3s ease-in-out;
  }
  .overlay.active {
    @media (max-width: 1024px) {
      height: 100%;
    }
  }
  .display-none {
    display: none;
    visibility: hidden;
  }
  .display-flex-grow {
    flex-grow: 1;
  }
  .container-col {
    display: flex;
    flex-direction: column;
    gap: var(--d-small);
  }
  .container-row {
    flex-direction: row;
  }
  .chat__header--thread {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
  .chat__container {
    min-width: 100%;
    width: 100%;
    transition: width 0.3s ease-in-out;
    max-height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Messages container - scrollable area */
  .chat__messages-container {
    flex: 1;
    // overflow-y: auto;
    // overflow-x: hidden;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Chat header styling */
  .chat__header--thread {
    flex-shrink: 0;
    padding: 0;
  }
  #chat-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  
  /* Chat header styling */
  .chat-header {
    padding: 1rem;
    border-bottom: 1px solid var(--chat_header_color, #e3e6f0);
    background: #f8f9fc;
    border-radius: 0.35rem 0.35rem 0 0;
    flex-shrink: 0;
  } 

  #chat-container > .chat__container {
    flex: 1;
    overflow: hidden;
    padding: 0;
    background: #f8f9fc;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  #chat-container > #chat-form {
    margin-top: 1rem;
    padding: 1rem;
    background: white;
    border: 1px solid var(--chat_header_color, #e3e6f0);
    border-radius: 0.35rem;
    flex-shrink: 0;
  }

  .chat__containerWrapper.aside-open {
    .chat__listItem {
      max-width: var(--width-wide);
    }
  }
  .chat__containerWrapper {
    display: grid;
    grid-template-columns: 1fr;
    gutter: var(--d-base);
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  /* Drag and drop styles */
  .chat__containerWrapper.drag-over {
    position: relative;
  }

  .chat__containerWrapper.drag-over::before {
    content: "📁 Drop files here to upload";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(105, 43, 97, 0.1);
    border: 3px dashed var(--c-accent-high);
    border-radius: var(--radius-base);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-rel-base);
    font-weight: bold;
    color: var(--c-accent-high);
    z-index: 100;
    pointer-events: none;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0% { 
      background: rgba(105, 43, 97, 0.1);
      border-color: var(--c-accent-high);
    }
    50% { 
      background: rgba(105, 43, 97, 0.2);
      border-color: var(--c-accent-dark);
    }
    100% { 
      background: rgba(105, 43, 97, 0.1);
      border-color: var(--c-accent-high);
    }
  }

  .chat__containerWrapper.drag-over .chat__container {
    opacity: 0.5;
  }

  #chat__containerWrapper .fullscreen-col{
    display: none;
  }
  #chat__containerWrapper.has-fullscreen {
    display: flex;
    flex-direction: row;
    gap: 15px;
  }
  #chat__containerWrapper.has-fullscreen #chat-container{
    min-width: auto;
    width: auto;
  }
  #chat__containerWrapper.has-fullscreen.aside-open #chat-container{
    min-width: 40%;
    width: 40%;
  }
  #chat__containerWrapper.has-fullscreen .fullscreen-col{
    display: block;
  }
  .chat__containerWrapper.aside-open {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-areas: 
      "chat"
      "aside";
    grid-template-rows: 1fr 1fr;
    grid-column-gap: var(--d-base);
    grid-row-gap: var(--d-base);
    flex: 1;
    overflow: hidden;
    min-height: 0;

    @media (min-width: 1024px) {
      grid-template-columns: 1fr 1fr;
      grid-template-areas: "chat aside";
      grid-template-rows: 1fr;
    }
  }
  .chat__containerWrapper.aside-open .chat__container {
    grid-area: chat;
    overflow: hidden;
    min-height: 0;
    max-height: 100%;
  }
  .chat__containerWrapper.aside-open .aside {
    grid-area: aside;
    width: 100%;
    border-left: var(--border-thin) solid var(--c-light-gray);
    max-width: none;
    min-width: 0;
    min-height: 0;
    max-height: 100%;
    overflow: hidden;

    @media (max-width: 1024px) {
      border-left: none;
      border-top: var(--border-thin) solid var(--c-light-gray);
    }
  }
  @media (max-width: 1024px) {
    .aside {
      top: var(-d-large);
      left: auto;
      z-index: 3;
      background: var(--c-white);
      display: block;
      padding: var(--d-base);
      position: absolute;
      width: var(--width-base);
      border-radius: var(--radius-base);
    }
  }
  .form__container {
    margin-bottom: 0;
    flex-shrink: 0;
  }
  .form__container-sticky {
    position: relative;
    bottom: auto;
    z-index: 1;
    border-radius: 0.35rem;
    background: white;
    box-shadow: none;
    padding: 0;
    border: 1px solid var(--chat_header_color, #e3e6f0);
    flex-shrink: 0;
  }

  /* Form container drag over state */
  .form__container.drag-over {
    border: 2px dashed var(--c-accent-high);
    background: rgba(105, 43, 97, 0.05);
    position: relative;
    transition: all 0.2s ease-in-out;
  }

  .form__container.drag-over::after {
    content: "📎 Drop files to attach";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--c-accent-high);
    font-size: var(--font-small);
    font-weight: bold;
    pointer-events: none;
    background: rgba(255, 255, 255, 0.9);
    padding: var(--d-xsmall) var(--d-small);
    border-radius: var(--radius-small);
    z-index: 10;
  }

  .form__label {
    display: block;
    padding: var(-d-xsmall) 0;
    font-size: var(--font-small);
  }
  .chatbox__button svg {
    fill: currentColor;
    width: 1em;
    height: 1em;
    vertical-align: -0.125em;
  }
  
  /* Button focus and disabled states */
  .chatbox__button:disabled,
  .chatbox__input:disabled {
    opacity: 0.65;
    cursor: not-allowed;
    background: #505050ff;
  }
  .chatbox__container {
    position: relative;
    height: auto;
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    width: 100%;
  }
  
  /* Input group styling like Bootstrap */
  .chatbox__input-container {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    width: 100%;
   
    background: white;
  }
  
  .chatbox__input-container:focus-within {
    outline: none;    
  }
  
  .chatbox__input {
    width: 100%;
    display: block;
    background: transparent;
    color: #212529;
    border: none;
    padding: 0.5rem 3.75rem 0.5rem 0.75rem;
    font-size: 1rem;
    font-weight: 400;
    line-height: 0.8;
    background-clip: padding-box;
    border-radius: 0.375rem 0 0 0.375rem;
    border: 1px solid #ced4da;
    min-height: 40px;
    max-height: 100px;
    resize: vertical;
    box-sizing: border-box;
    // border-radius: 0.375rem;
  }

  .input_container_wrapper{
    position: relative;
    flex: 1 1 auto;
    width: 1%;
    min-width: 0;
  }

  .input_container_wrapper loading-indicator{
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 5px;
    padding: 0 5px;
  }
  
  .chatbox__input:focus {
    outline: 0;
    box-shadow: none;
    border-color: var(--primary-color);    
  }
  
  .chatbox__input::placeholder {
    color: #6c757d;
    opacity: 1;
  }
  
  /* Input group append styling */
  .input-group-append {
    display: flex;
    margin-left: -1px;
    align-items: flex-start;
  }
  
  .input-group-append .chatbox__button {
    position: relative;
    z-index: 2;
    margin-left: 0;
    border-radius: 0;
    height: 44px;
    align-self: flex-start;
  }
  
  .input-group-append .chatbox__button:first-child {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  
  .input-group-append .chatbox__button:last-child {
    border-top-right-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
  }
  
  .input-group-append .chatbox__button:not(:last-child) {
    border-right: 0;
  }
  /* Button styles for different variants */
  .chatbox__button {
    display: inline-block;
    font-weight: 400;
    line-height: 1.5;
    color: #fff;
    text-align: center;
    text-decoration: none;
    vertical-align: middle;
    cursor: pointer;
    user-select: none;
    background-color: var(--primary-color);
    border: 1px solid var(--primary-color);    
    font-size: 1rem;
    border-radius: 0;
    flex: 1 1 auto;
    padding: 0px 10px;
  }
  
  .chatbox__button:hover {
    color: #fff;
    background-color: var(--primary-color);
    border-color: var(--primary-color);
  }
  
  .chatbox__button:focus {
    color: #fff;
    background-color: var(--primary-color);
    border-color: var(--primary-color);    
  }
  
  .chatbox__button:disabled {
    pointer-events: none;
    opacity: 0.65;
  }
  
  /* Button variants */
  .chatbox__button.btn-outline-secondary {
    color: var(--alt_blu);
    border-color: var(--alt_blu);
    background-color: transparent;
  }
  
  .chatbox__button.btn-outline-secondary:hover {
    color: #fff;
    background-color: var(--alt_blu);
    border-color: var(--alt_blu);
  }
  
  .chatbox__button.btn-outline-danger {
    color: #dc3545;
    border-color: #dc3545;
    background-color: transparent;
  }
  
  .chatbox__button.btn-outline-danger:hover {
    color: #fff;
    background-color: #dc3545;
    border-color: #dc3545;
  }
  
  .chatbox__button--reset {
    position: absolute;
    right: 115px;
    top: 15px;
    background: #dc3545;
    border: 1px solid #dc3545;
    color: white;
    border-radius: 0.375rem;
    font-weight: normal;
    height: auto;
    width: auto;
    padding: 0.375rem 0.75rem;
    cursor: pointer;
  }
  
  .chatbox__button--reset.started{
    right: 210px;
  }
  /* Chat options styling like Bootstrap form-check */
  .web-search__wrapper {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
  }
  
  .web-search__container {
    padding: 0;    
    position: relative;
    display: block;
  }
  
  .web-search__checkbox {
    position: absolute;
    top: 0.25rem;
    left: 0;
    z-index: 2;
    width: 13px;
    height: 13px;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  
  .web-search__label {
    display: inline-block;
    font-size: 0.875rem;
    color: #6c757d;
    cursor: pointer;
    padding-left: 1.5rem;
    margin-bottom: 0;
    position: relative;
    font-weight: 500;
  }
  
  .web-search__label::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 13px;
    height: 13px;
    pointer-events: none;
    background-color: #fff;
    border: 1px solid #adb5bd;
    border-radius: 0.25em;
  }
  
  .web-search__label::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 13px;
    height: 13px;
    background-repeat: no-repeat;
    background-position: center center;
    background-size: 0.5em 0.5em;
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
  }
  
  .web-search__checkbox:checked ~ .web-search__label::before {
      color: #fff;
      border-color: #2F2E2D;
      background-color: #2F2E2D;
  }
  
  .web-search__checkbox:checked ~ .web-search__label::after {
    opacity: 1;
    background-color: white;
    mask: url("/assets/images/check.svg") no-repeat center center;
    mask-size: 0.5em 0.5em;
    -webkit-mask: url("/assets/images/check.svg") no-repeat center center;
    -webkit-mask-size: 0.5em 0.5em;
  }
  
  .web-search__checkbox:focus ~ .web-search__label::before {
    border-color: #86b7fe;
    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
  }

  .aside__header {
    display: flex;
    justify-content: end;
  }
  .tab-component__content {
    padding: var(--d-base) var(--d-base) var(--d-base) 0;
  }
  .tab-component__paragraph {
    font-family: monospace;
    font-size: var(--font-large);
    border: var(--border-thin) solid var(--c-light-gray);
    border-radius: var(--radius-large);
    padding: var(--d-base);
  }
  .settings-toggler {
    margin-left: auto;
  }
  .settings-toggler button{
    background: none;
    border: 1px solid var(--alt_blu);
    border-radius: 5px;
    cursor: pointer;
    color: var(--alt_blu);
    padding: 5px;
  }
    
  #chat-form .input_container_wrapper .chatbox__file_prompt{
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    box-shadow: none;
    padding: 5px;

    border-radius: 0.375rem;
    border: 1px solid var(--chat_border_color, #ced4da);
    cursor:pointer;
    color: var(--chat_border_color, #ced4da);    
  }

  #chat-form .input_container_wrapper .chatbox__file_prompt:hover {
    color: var(--alt_blu);
    border-color: var(--alt_blu);
  }

  #file-prompt-preview {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    flex-direction: row; 

    .file-prompt__file {
      display: flex;
      flex-direction: column;
      gap: 10px;
      border-radius: 0.375rem;
      border: 1px solid var(--chat_border_color, #ced4da);
      padding: 0.25rem;
      width: 120px;
      

      .file-prompt__header{
        .file-prompt__file-name {
        font-size: 0.75rem;
        }         
      }

      .file-prompt__img{
        display: block;
        width: 100%;
        height: 85px;
        border-radius: 0.375rem;
        border: 1px solid var(--chat_border_color, #ced4da);
      } 

      .file-prompt__file-icon {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--background_color, #f8f9fa);
        
        i {
          font-size: 1.5rem;
          color: var(--chat_border_color, #ced4da);
          margin-bottom: 0.25rem;
        }
        
        span {
          font-size: 0.6rem;
          color: var(--chat_border_color, #ced4da);
          font-weight: bold;
        }
      }
        
      .file-prompt__footer{
        display: flex;
        flex-direction: row;
        gap: 10px;
        width: 100%;
        justify-content: space-between;

        .file-prompt__file-size{
          color: var(--chat_border_color, #ced4da);
          font-size: 0.85rem;
        }        

        button.file-prompt__remove-button {
          background: var(--error_color, #900);
          color: #FFF;  
          box-shadow: none;
          border: none;
          border-radius: 0.375rem;  
          cursor: pointer;
        }

      }
      
    }  
  }
`;
