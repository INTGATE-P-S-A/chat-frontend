import { css } from 'lit';

export const styles = css`

  button {
    color: var(--alt_blu);
    font-weight: bold;    
    background: transparent;
    transition: background 0.3s ease-in-out;
    box-shadow: none;
    border: none;
    cursor: pointer;      
    width: 100%;
    height: 100%;
    padding: 0;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    color: var(--text-muted, #888);
  }
  button:disabled:hover {
    color: var(--text-muted, #888);
  }
  button:hover:not(:disabled) {    
    color: #fff;
  }
  :host{
    box-sizing: border-box;
    display: inline-flex !important;
    align-items: center;
  }
  :host(:hover) button:not(:disabled){
    color: #fff;
  }
  :host(:hover) button:disabled{
    color: var(--text-muted, #888);
  }
  button:hover:not(:disabled) svg,
  button:focus:not(:disabled) svg {
    opacity: 0.8;
  }
  .not-recording svg {
    color: var(--alt_blu);
  }
  button:disabled .not-recording svg,
  button:disabled .recording svg {
    color: var(--text-muted, #888);
    opacity: 0.5;
  }
  .recording svg {
    
  }
  .simple-icon-close{
    font-size: 10px;
  }
`;
