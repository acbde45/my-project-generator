#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const createApp = require('../scripts/create');

let projectName;

const program = new Command();
program
  .arguments('[project-directory]')
  .usage(`${chalk.green('<project-directory>')} [options]`)
  .option('--verbose', '打印额外的日志')
  .option(
    '--template <path-to-template>',
    '指定创建项目的模版',
  )
  .option('--by <package-manager>', '选择包管理工具', 'yarn')
  .action((name) => {
    projectName = name;
    if (typeof projectName === 'undefined') {
      console.error('请指定项目目录：');
      console.log(
        `  ${chalk.cyan(program.name())} new ${chalk.green('<project-directory>')}`
      );
      console.log();
      console.log('比如:');
      console.log(
        `  ${chalk.cyan(program.name())} new ${chalk.green('my-react-app')}`
      );
      console.log();
      process.exit(1);
    }
    
    if (!['yarn', 'npm', 'tnpm'].includes(program.by)) {
      console.error('选择正确的包管理工具：');
      console.log(
        `  ${chalk.cyan(program.name())} ${chalk.green('<package-manager>')}`
      );
      console.log();
      console.log('比如:');
      console.log(
        `  ${chalk.cyan(program.name())} ${chalk.green('yarn')}, 支持${chalk.blue('yarn，npm, tnpm')}`
      );
      console.log();
      process.exit(1);
    }
  })
  .parse(process.argv);

createApp(
  projectName,
  program.verbose,
  program.template,
  program.by,
);
