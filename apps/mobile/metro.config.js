const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch the entire monorepo so Metro can resolve shared packages
config.watchFolders = [monorepoRoot]

// Resolve node_modules from the app first, then the monorepo root.
// This ensures a single copy of react/react-native is used throughout.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

module.exports = withNativeWind(config, { input: './global.css' })
