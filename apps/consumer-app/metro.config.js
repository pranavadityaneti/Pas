const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Map native-only modules to empty objects on web to prevent bundling errors
if (config.resolver) {
    const oldResolveRequest = config.resolver.resolveRequest;
    config.resolver.resolveRequest = (context, moduleName, platform) => {
        if (platform === 'web' && moduleName === 'react-native-maps') {
            return {
                type: 'empty',
            };
        }
        if (oldResolveRequest) {
            return oldResolveRequest(context, moduleName, platform);
        }
        return context.resolveRequest(context, moduleName, platform);
    };
}

module.exports = config;
