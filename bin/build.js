#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const startApp = require('../scripts/build');

const program = new Command();
program
  .option('--stats <stats>', '生成统计文件')
  .action(async (cmd) => {
    startApp({
      host: cmd.host,
      port: cmd.port,
    });
  });
program.parse(process.argv)
