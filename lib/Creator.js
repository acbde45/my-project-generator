const execa = require('execa');
const debug = require('debug');
const inquirer = require('inquirer');
const chalk = require('chalk');
const cloneDeep = require('lodash.clonedeep');
const PromptModuleAPI = require('./PromptModuleAPI');
const { error, clearConsole, log } = require('./util/logger');
const { exit } = require('./util/exit');
const {
  hasGit,
  hasProjectGit,
  hasYarn,
  hasTnpm,
  hasPnpm3OrLater,
  hasPnpmVersionOrLater,
} = require('./util/env');
const {
  defaults,
  saveOptions,
  loadOptions,
  validatePreset,
  savePreset,
  rcPath,
} = require('./options');

const isManualMode = (answers) => answers.preset === '__manual__';

module.exports = class Creator {
  constructor(name, context, promptModules) {
    this.name = name;
    this.context = process.env.MPG_CONTEXT = context;
    const { presetPrompt, featurePrompt } = this.resolveIntroPrompts();

    this.presetPrompt = presetPrompt;
    this.featurePrompt = featurePrompt;
    this.outroPrompts = this.resolveOutroPrompts();
    this.injectedPrompts = [];
    this.promptCompleteCbs = [];
    this.afterInvokeCbs = [];
    this.afterAnyInvokeCbs = [];

    this.run = this.run.bind(this);

    const promptAPI = new PromptModuleAPI(this);
    promptModules.forEach((m) => m(promptAPI));
  }

  // 创建主流程
  async create(cliOptions = {}, preset = null) {
    const { run, name, context, afterInvokeCbs, afterAnyInvokeCbs } = this;

    if (!preset) {
      if (cliOptions.preset) {
        // mpg create foo --preset bar
        preset = await this.resolvePreset(cliOptions.preset, cliOptions.clone);
      } else if (cliOptions.default) {
        // mpg create foo --default
        preset = defaults.presets.default;
      } else if (cliOptions.inlinePreset) {
        // mpg create foo --inlinePreset {...}
        try {
          preset = JSON.parse(cliOptions.inlinePreset);
        } catch (e) {
          error(
            `CLI inline preset is not valid JSON: ${cliOptions.inlinePreset}`,
          );
          exit(1);
        }
      } else {
        preset = await this.promptAndResolvePreset();
      }
    }

    // TODO go on
  }

  // 执行终端命令
  run(command, args) {
    if (!args) {
      [command, ...args] = command.split(/\s+/);
    }
    return execa(command, args, { cwd: this.context });
  }

  // 提示并且处理preset
  async promptAndResolvePreset(answers = null) {
    // prompt
    if (!answers) {
      await clearConsole();
      answers = await inquirer.prompt(this.resolveFinalPrompts());
    }
    debug('mpg:answers')(answers);

    if (answers.packageManager) {
      saveOptions({
        packageManager: answers.packageManager,
      });
    }

    let preset;
    if (answers.preset && answers.preset !== '__manual__') {
      preset = await this.resolvePreset(answers.preset);
    } else {
      // manual
      preset = {
        useConfigFiles: answers.useConfigFiles === 'files',
        plugins: {},
      };
      answers.features = answers.features || [];
      // run cb registered by prompt modules to finalize the preset
      this.promptCompleteCbs.forEach((cb) => cb(answers, preset));
    }

    // validate
    validatePreset(preset);

    // save preset
    if (
      answers.save &&
      answers.saveName &&
      savePreset(answers.saveName, preset)
    ) {
      log();
      log(
        `🎉  Preset ${chalk.yellow(answers.saveName)} saved in ${chalk.yellow(
          rcPath,
        )}`,
      );
    }

    debug('mpg:preset')(preset);
    return preset;
  }

  // 根据输入找到已保存的preset
  async resolvePreset(name) {
    let preset;
    const savedPresets = this.getPresets();

    if (name in savedPresets) {
      preset = savedPresets[name];
    } else if (
      name.endsWith('.json') ||
      /^\./.test(name) ||
      path.isAbsolute(name)
    ) {
      preset = await loadLocalPreset(path.resolve(name));
    }

    if (!preset) {
      error(`preset "${name}" not found.`);
      const presets = Object.keys(savedPresets);
      if (presets.length) {
        log();
        log(`available presets:\n${presets.join(`\n`)}`);
      } else {
        log(`you don't seem to have any saved preset.`);
        log(`run mpg in manual mode to create a preset.`);
      }
      exit(1);
    }
    return preset;
  }

  // 获取保存的配置
  getPresets() {
    const savedOptions = loadOptions();
    return Object.assign({}, savedOptions.presets, defaults.presets);
  }

  // 处理框架相关的配置
  resolveIntroPrompts() {
    const presets = this.getPresets();
    const presetChoices = Object.entries(presets).map(([name, preset]) => {
      let displayName = name;
      if (name === 'default') {
        displayName = 'Default';
      }

      return {
        name: `${displayName}`,
        value: name,
      };
    });
    const presetPrompt = {
      name: 'preset',
      type: 'list',
      message: `Please pick a preset:`,
      choices: [
        ...presetChoices,
        {
          name: 'Manually select features',
          value: '__manual__',
        },
      ],
    };
    const featurePrompt = {
      name: 'features',
      when: isManualMode,
      type: 'checkbox',
      message: 'Check the features needed for your project:',
      choices: [],
      pageSize: 10,
    };
    return {
      presetPrompt,
      featurePrompt,
    };
  }

  // 处理项目相关的配置
  resolveOutroPrompts() {
    const outroPrompts = [
      {
        name: 'useConfigFiles',
        when: isManualMode,
        type: 'list',
        message: 'Where do you prefer placing config for Babel, ESLint, etc.?',
        choices: [
          {
            name: 'In dedicated config files',
            value: 'files',
          },
          {
            name: 'In package.json',
            value: 'pkg',
          },
        ],
      },
      {
        name: 'save',
        when: isManualMode,
        type: 'confirm',
        message: 'Save this as a preset for future projects?',
        default: false,
      },
      {
        name: 'saveName',
        when: (answers) => answers.save,
        type: 'input',
        message: 'Save preset as:',
      },
    ];

    // ask for packageManager once
    const savedOptions = loadOptions();
    if (
      !savedOptions.packageManager &&
      (hasYarn() || hasTnpm() || hasPnpm3OrLater())
    ) {
      const packageManagerChoices = [];

      if (hasYarn()) {
        packageManagerChoices.push({
          name: 'Use Yarn',
          value: 'yarn',
          short: 'Yarn',
        });
      }

      if (hasTnpm()) {
        packageManagerChoices.push({
          name: 'Use Tnpm',
          value: 'tnpm',
          short: 'Tnpm',
        });
      }

      if (hasPnpm3OrLater()) {
        packageManagerChoices.push({
          name: 'Use PNPM',
          value: 'pnpm',
          short: 'PNPM',
        });
      }

      packageManagerChoices.push({
        name: 'Use NPM',
        value: 'npm',
        short: 'NPM',
      });

      outroPrompts.push({
        name: 'packageManager',
        type: 'list',
        message:
          'Pick the package manager to use when installing dependencies:',
        choices: packageManagerChoices,
      });
    }
    return outroPrompts;
  }

  // 组合所有的提示
  resolveFinalPrompts() {
    // patch generator-injected prompts to only show in manual mode
    this.injectedPrompts.forEach((prompt) => {
      const originalWhen = prompt.when || (() => true);
      prompt.when = (answers) => {
        return isManualMode(answers) && originalWhen(answers);
      };
    });

    const prompts = [
      this.presetPrompt,
      this.featurePrompt,
      ...this.injectedPrompts,
      ...this.outroPrompts,
    ];
    debug('mpg:prompts')(prompts);
    return prompts;
  }

  // 应该初始化git吗
  shouldInitGit(cliOptions) {
    if (!hasGit()) {
      return false;
    }
    // --git
    if (cliOptions.forceGit) {
      return true;
    }
    // --no-git
    if (cliOptions.git === false || cliOptions.git === 'false') {
      return false;
    }
    // default: true unless already in a git repo
    return !hasProjectGit(this.context);
  }
};
