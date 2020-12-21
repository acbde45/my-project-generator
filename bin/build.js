#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const buildApp = require('../scripts/build');

const program = new Command();

buildApp();
