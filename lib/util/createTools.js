exports.getPromptModules = () => {
  return [
    'babel',
    'typescript',
    'cssPreprocessors',
    'linter',
    'unit',
    'redux',
    'router',
  ].map((file) => require(`../promptModules/${file}`));
};
