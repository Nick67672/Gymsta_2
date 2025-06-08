const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add custom resolver to handle Node.js modules not available in React Native
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Create custom resolver for Node.js modules
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle specific Node.js modules that cause issues
  if (moduleName === 'stream') {
    return {
      filePath: require.resolve('readable-stream'),
      type: 'sourceFile',
    };
  }
  
  if (moduleName === 'buffer') {
    return {
      filePath: require.resolve('@craftzdog/react-native-buffer'),
      type: 'sourceFile',
    };
  }
  
  if (moduleName === 'crypto') {
    return {
      filePath: require.resolve('react-native-crypto'),
      type: 'sourceFile',
    };
  }
  
  // For ws module, return our polyfill
  if (moduleName === 'ws') {
    return {
      filePath: path.resolve(__dirname, 'polyfills/ws-polyfill.js'),
      type: 'sourceFile',
    };
  }
  
  // For other Node.js built-ins, try to resolve with fallbacks
  const nodeBuiltins = ['events', 'util', 'url', 'querystring', 'os', 'path', 'fs'];
  if (nodeBuiltins.includes(moduleName)) {
    try {
      return {
        filePath: require.resolve(moduleName),
        type: 'sourceFile',
      };
    } catch (error) {
      console.warn(`Could not resolve Node.js builtin '${moduleName}', providing empty module`);
      return {
        filePath: path.resolve(__dirname, 'polyfills/empty-module.js'),
        type: 'sourceFile',
      };
    }
  }
  
  // Use the default resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config; 