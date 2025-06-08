// WebSocket polyfill for React Native
// This completely replaces the 'ws' module to prevent Node.js dependencies

// Create a WebSocket implementation that uses React Native's WebSocket
class WSPolyfill {
  constructor(url, protocols, options) {
    // Use React Native's WebSocket
    this.ws = new WebSocket(url, protocols);
    
    // Forward all WebSocket events
    this.ws.onopen = (event) => this.onopen?.(event);
    this.ws.onclose = (event) => this.onclose?.(event);
    this.ws.onmessage = (event) => this.onmessage?.(event);
    this.ws.onerror = (event) => this.onerror?.(event);
  }
  
  send(data) {
    return this.ws.send(data);
  }
  
  close(code, reason) {
    return this.ws.close(code, reason);
  }
  
  get readyState() {
    return this.ws.readyState;
  }
  
  get url() {
    return this.ws.url;
  }
  
  addEventListener(type, listener) {
    return this.ws.addEventListener(type, listener);
  }
  
  removeEventListener(type, listener) {
    return this.ws.removeEventListener(type, listener);
  }
}

// Export the polyfill as the default export
module.exports = WSPolyfill;
module.exports.default = WSPolyfill;

// Also provide static constants
module.exports.CONNECTING = 0;
module.exports.OPEN = 1;
module.exports.CLOSING = 2;
module.exports.CLOSED = 3;

// If anything tries to use WebSocket as a constructor, provide a stub
if (typeof global !== 'undefined' && !global.WebSocket) {
  global.WebSocket = global.WebSocket || require('react-native').WebSocket;
} 