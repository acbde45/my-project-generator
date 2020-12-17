#!/usr/bin/env node

'use strict';

var currentNodeVersion = process.versions.node;
var semver = currentNodeVersion.split('.');
var major = semver[0];

if (major < 10) {
  console.log(`你正在运行 Node${currentNodeVersion}。\n请尝试使用大于10或者更高的版本。`);
  process.exit(1);
}

require('../lib').command();
