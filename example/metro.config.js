const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so editing package source hot-reloads the app.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Resolve @rnchart/* to workspace SOURCE rather than to built output.
//
// Done explicitly instead of relying on the `source` export condition: the
// packages publish an `exports` map, and Metro honours `exports` ahead of the
// `react-native` field, which would otherwise send development builds to a
// `lib/` directory that does not exist until `yarn build` has run.
const workspacePackages = ['core', 'skia', 'charts'];

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const match = /^@rnchart\/([^/]+)$/.exec(moduleName);

  if (match && workspacePackages.includes(match[1])) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(
        workspaceRoot,
        'packages',
        match[1],
        'src',
        'index.ts'
      ),
    };
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
