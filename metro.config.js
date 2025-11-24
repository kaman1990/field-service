const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable package exports for UMD support
config.resolver.unstable_enablePackageExports = true;

// Configure platform-specific module resolution
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (['react-native-prompt-android', '@powersync/react-native'].includes(moduleName)) {
      return { type: 'empty' };
    }
    
    const mapping = {
      'react-native': 'react-native-web',
      '@powersync/web': '@powersync/web/umd'
    };
    
    if (mapping[moduleName]) {
      return context.resolveRequest(context, mapping[moduleName], platform);
    }
  } else {
    if (['@powersync/web'].includes(moduleName)) {
      return { type: 'empty' };
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

