const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

let config = getDefaultConfig(__dirname);
config = withNativeWind(config, { input: './global.css' });

// Workaround: NativeWind v4.0.36 web bug — transformer emits require(output) but
// CLI generates output.web.css. Redirect the unresolved base path to the .web.css file.
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = {
  ...config.resolver,
  resolveRequest(context, moduleName, platform) {
    if (
      platform === 'web' &&
      moduleName.endsWith(path.join('.cache', 'nativewind', 'global.css'))
    ) {
      const webCssPath = moduleName + '.web.css';
      if (fs.existsSync(webCssPath)) {
        return { type: 'sourceFile', filePath: webCssPath };
      }
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
