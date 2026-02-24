const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
// Monorepo root (two levels up from apps/mobile)
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo so Metro finds packages in the pnpm store
config.watchFolders = [workspaceRoot];

// Tell Metro where to look for modules in priority order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Enable symlink support so Metro correctly follows pnpm's symlink structure
// instead of getting confused by the .pnpm virtual store layout
config.resolver.unstable_enableSymlinks = true;

// Disable hierarchical lookup to prevent Metro crawling up past the workspace root
// into C:\Users\<user>\node_modules where stale global packages live
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
