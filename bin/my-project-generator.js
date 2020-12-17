#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const chalk = require('chalk');
const envinfo = require('envinfo');

const packageJson = require(path.resolve(__dirname, '../package.json'));

const program = new Command();
program
  .version(packageJson.version)
  .name(packageJson.name)
  .usage(`${chalk.green('[command]')} [options]`)
  .option('--info', '打印环境调试信息')
  .command('new <project-directory>', '创建新项目', { executableFile: 'new.js' })
  .action(cmd => {
    if (cmd.info) {
      printEnvInfo();
    };
  })
  .allowUnknownOption()
  .parse(process.argv);

function printEnvInfo() {
  console.log(chalk.bold('\n环境信息:'));
  console.log(
    `\n  当前版本 ${packageJson.name}: ${packageJson.version}`
  );
  console.log(`  运行于 ${__dirname}`);
  return envinfo
    .run(
      {
        System: ['OS', 'CPU'],
        Binaries: ['Node', 'npm', 'Yarn'],
        Browsers: [
          'Chrome',
          'Edge',
          'Internet Explorer',
          'Firefox',
          'Safari',
        ],
        npmPackages: ['react', 'react-dom', 'react-scripts'],
        npmGlobalPackages: ['create-react-app'],
      },
      {
        duplicates: true,
        showNotFound: true,
      }
    )
    .then(console.log);
}
