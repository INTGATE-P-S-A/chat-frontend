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
  button:hover,
  {    
    color: #fff;
  }
  :host{
    box-sizing: border-box;
  }
  :host(:hover) button{
    color: #fff;
  }
  button:hover svg,
  button:focus svg {
    opacity: 0.8;
  }
  .not-recording svg {
    color: var(--alt_blu);
  }
  .recording svg {
    
  }
  .simple-icon-close{
    font-size: 10px;
  }
`;
