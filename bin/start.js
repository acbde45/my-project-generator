#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const startApp = require('../scripts/start');

const program = new Command();

startApp();
