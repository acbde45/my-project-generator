'use strict';

const fs = require('fs-extra');
const path = require('path');
const merge = require('webpack-merge');
const log = require('../utils/log');
const cwd = process.cwd();

module.exports = async function(mode, options = {}) {
  const config = require(`./${mode}`);
  const userConfigPath = path.resolve(cwd, './mpg.config.js');

  try {
    let userConfigContents = {};
    try {
      await fs.access(userConfigPath);
      userConfigContents = require(userConfigPath);
    } catch (e) {}
    if (typeof userConfigContents === 'function') {
      return userConfigContents(config(options), mode);
    } else if (userConfigContents) {
      return merge.smart(config(options), userConfigContents)
    }
    return config(options)
  } catch (e) {
    log.error(e.stack)
  }
  return config(options)
}
