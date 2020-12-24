#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const startApp = require('../scripts/start');

const program = new Command();
program
  .option('--host <host>', '自定义主机', '0.0.0.0')
  .option('--port <port>', '自定义端口', 3000)
  .action(async (cmd) => {
    startApp({
      host: cmd.host,
      port: cmd.port,
    });
  });
program.parse(process.argv)
