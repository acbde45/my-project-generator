#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const startApp = require('../scripts/start');

const program = new Command();
program
  .action(async (cmd) => {
    try {
        await startApp();
    } catch (e) {
        console.log(e)
    }
  });
program.parse(process.argv)
