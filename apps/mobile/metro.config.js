const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch the whole monorepo so Metro can resolve shared packages
config.watchFolders = [monorepoRoot]

// Resolution order: app node_modules first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Force all files — including packages hoisted to root/node_modules —
// to resolve react and react-native from the same absolute path.
// Without this, packages in root/node_modules (e.g. @react-navigation)
// would climb up the directory tree and find root/node_modules/react@19.2.5
// while app code uses apps/mobile/node_modules/react@19.1.0, causing
// "Invalid hook call" errors.
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules', 'react'),
  'react-native': path.resolve(projectRoot, 'node_modules', 'react-native'),
  'react-dom': path.resolve(projectRoot, 'node_modules', 'react-dom'),
}

module.exports = withNativeWind(config, { input: './global.css' })
