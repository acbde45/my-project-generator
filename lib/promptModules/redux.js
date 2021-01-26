module.exports = (cli) => {
  cli.injectFeature({
    name: 'Redux',
    value: 'redux',
    description: 'Manage the app state with a centralized store',
  });

  cli.onPromptComplete((answers, options) => {
    if (answers.features.includes('redux')) {
      options.plugins['redux'] = {};
    }
  });
};
