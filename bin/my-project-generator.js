#!/usr/bin/env node

const path = require('path');
const program = require('commander');
const minimist = require('minimist');
const leven = require('leven');
const chalk = require('chalk');
const semver = require('semver');
const pkg = require(path.join(__dirname, '../package.json'));
const requiredVersion = pkg.engines.node;

function checkNodeVersion(wanted, id) {
  if (!semver.satisfies(process.version, wanted, { includePrerelease: true })) {
    console.log(
      chalk.red(
        'You are using Node ' +
          process.version +
          ', but this version of ' +
          id +
          ' requires Node ' +
          wanted +
          '.\nPlease upgrade your Node version.',
      ),
    );
    process.exit(1);
  }
}

// 检查node版本
checkNodeVersion(requiredVersion, 'mpg');

program
  .name('mpg')
  .usage('[command] [options]')
  .version(pkg.version, '-v --version');

// 新建项目
program
  .command('new <project-name>')
  .description('create a new project')
  .option('-d, --default', 'Skip prompts and use default preset')
  .option(
    '-m, --packageManager <command>',
    'Use specified npm client when installing dependencies',
  )
  .option(
    '-r, --registry <url>',
    'Use specified npm registry when installing dependencies (only for npm)',
  )
  .option(
    '-g, --git [message]',
    'Force git initialization with initial commit message',
  )
  .option('-n, --no-git', 'Skip git initialization')
  .option('-f, --force', 'Overwrite target directory if it exists')
  .option('--merge', 'Merge target directory if it exists')
  .option('-x, --proxy <proxyUrl>', 'Use specified proxy when creating project')
  .option('-b, --bare', 'Scaffold project without beginner instructions')
  .option('--skipGetStarted', 'Skip displaying "Get started" instructions')
  .action((name, cmd) => {
    const options = cleanArgs(cmd);

    if (minimist(process.argv.slice(3))._.length > 1) {
      console.log(
        chalk.yellow(
          "\n Info: You provided more than one argument. The first one will be used as the app's name, the rest are ignored.",
        ),
      );
    }
    // --git makes commander to default git to true
    if (process.argv.includes('-g') || process.argv.includes('--git')) {
      options.forceGit = true;
    }
    require('../lib/create')(name, options);
  });

// 打包项目
program
  .command('build')
  .description('build code for production environment')
  .action(() => {
    // require('../lib/util/runNpmScript')('build', process.argv.slice(3));
  });

// 开发环境启动项目
program
  .command('start')
  .description('start the project on development environment')
  .action(() => {
    // require('../lib/util/runNpmScript')('start', process.argv.slice(3));
  });

// 打印环境信息
program
  .command('info')
  .description('print debugging information about your environment')
  .action(() => {
    console.log(chalk.bold('\nEnvironment Info:'));
    require('envinfo')
      .run(
        {
          System: ['OS', 'CPU'],
          Binaries: ['Node', 'Yarn', 'npm'],
          Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
          npmPackages: '/**/{typescript,*react*/}',
          npmGlobalPackages: ['mpg'],
        },
        {
          showNotFound: true,
          duplicates: true,
          fullTree: true,
        },
      )
      .then(console.log);
  });

// output help information on unknown commands
program.arguments('<command>').action((cmd) => {
  program.outputHelp();
  console.log(`  ` + chalk.red(`Unknown command ${chalk.yellow(cmd)}.`));
  console.log();
  suggestCommands(cmd);
  process.exitCode = 1;
});

// add some useful info on help
program.on('--help', () => {
  console.log();
  console.log(
    `  Run ${chalk.cyan(
      `mpg <command> --help`,
    )} for detailed usage of given command.`,
  );
  console.log();
});

program.commands.forEach((c) => c.on('--help', () => console.log()));

// enhance common error messages
const enhanceErrorMessages = require('../lib/util/enhanceErrorMessages');

enhanceErrorMessages('missingArgument', (argName) => {
  return `Missing required argument ${chalk.yellow(`<${argName}>`)}.`;
});

enhanceErrorMessages('unknownOption', (optionName) => {
  return `Unknown option ${chalk.yellow(optionName)}.`;
});

enhanceErrorMessages('optionMissingArgument', (option, flag) => {
  return (
    `Missing required argument for option ${chalk.yellow(option.flags)}` +
    (flag ? `, got ${chalk.yellow(flag)}` : ``)
  );
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// 猜测用户意图
function suggestCommands(unknownCommand) {
  const availableCommands = program.commands.map((cmd) => cmd._name);

  let suggestion;

  availableCommands.forEach((cmd) => {
    const isBestMatch =
      leven(cmd, unknownCommand) < leven(suggestion || '', unknownCommand);
    if (leven(cmd, unknownCommand) < 3 && isBestMatch) {
      suggestion = cmd;
    }
  });

  if (suggestion) {
    console.log(`  ` + chalk.red(`Did you mean ${chalk.yellow(suggestion)}?`));
  }
}

function camelize(str) {
  return str.replace(/-(\w)/g, (_, c) => (c ? c.toUpperCase() : ''));
}

// commander passes the Command object itself as options,
// extract only actual options into a fresh object.
function cleanArgs(cmd) {
  const args = {};
  cmd.options.forEach((o) => {
    const key = camelize(o.long.replace(/^--/, ''));
    // if an option is not present and Command has a method with the same name
    // it should not be copied
    if (typeof cmd[key] !== 'function' && typeof cmd[key] !== 'undefined') {
      args[key] = cmd[key];
    }
  });
  return args;
}
