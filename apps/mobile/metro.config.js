const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch only the shared package (not full monorepo root — avoids watching platform-specific binary dirs in root node_modules)
config.watchFolders = [path.resolve(monorepoRoot, 'packages', 'shared')];

// Resolve @junto/shared alias
config.resolver.extraNodeModules = {
  '@junto/shared': path.resolve(monorepoRoot, 'packages/shared/src/types/index.ts'),
};

module.exports = withNativeWind(config, { input: './global.css' });
