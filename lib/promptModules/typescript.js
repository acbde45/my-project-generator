module.exports = (cli) => {
  cli.injectFeature({
    name: 'TypeScript',
    value: 'ts',
    short: 'TS',
    description: 'Add support for the TypeScript language',
    plugins: ['typescript'],
  });

  cli.injectPrompt({
    name: 'useTsWithBabel',
    when: (answers) => answers.features.includes('ts'),
    type: 'confirm',
    message:
      'Use Babel alongside TypeScript (required for modern mode, auto-detected polyfills, transpiling JSX)?',
    description:
      'It will output ES2015 and delegate the rest to Babel for auto polyfill based on browser targets.',
    default: (answers) => answers.features.includes('babel'),
  });

  cli.onPromptComplete((answers, options) => {
    if (answers.features.includes('ts')) {
      const tsOptions = {};
      if (answers.useTsWithBabel) {
        tsOptions.useTsWithBabel = true;
      }
      options.plugins['typescript'] = tsOptions;
    }
  });
};
