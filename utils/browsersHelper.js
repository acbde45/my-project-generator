const browserslist = require('browserslist');
const chalk = require('chalk');
const os = require('os');
const prompts = require('prompts');
const pkgUp = require('pkg-up');
const fs = require('fs');

const defaultBrowsers = {
  production: ['>0.2%', 'not dead', 'not op_mini all'],
  development: [
    'last 1 chrome version',
    'last 1 firefox version',
    'last 1 safari version',
  ],
};

function shouldSetBrowsers(isInteractive) {
  if (!isInteractive) {
    return Promise.resolve(true);
  }

  const question = {
    type: 'confirm',
    name: 'shouldSetBrowsers',
    message:
      chalk.yellow("无法检测到要支持的浏览器") +
      `\n\n是否添加默认值到 ${chalk.bold(
        'package.json'
      )}?`,
    initial: true,
  };

  return prompts(question).then(answer => answer.shouldSetBrowsers);
}

function checkBrowsers(dir, isInteractive, retry = true) {
  const current = browserslist.loadConfig({ path: dir });
  if (current != null) {
    return Promise.resolve(current);
  }

  if (!retry) {
    return Promise.reject(
      new Error(
        chalk.red(
          '你必须指定要支持的浏览器。'
        ) +
          os.EOL +
          `添加一个 ${chalk.underline(
            'browserslist'
          )} 属性到你的 ${chalk.bold('package.json')}.`
      )
    );
  }

  return shouldSetBrowsers(isInteractive).then(shouldSetBrowsers => {
    if (!shouldSetBrowsers) {
      return checkBrowsers(dir, isInteractive, false);
    }

    return (
      pkgUp({ cwd: dir })
        .then(filePath => {
          if (filePath == null) {
            return Promise.reject();
          }
          const pkg = JSON.parse(fs.readFileSync(filePath));
          pkg['browserslist'] = defaultBrowsers;
          fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + os.EOL);

          browserslist.clearCaches();
          console.log();
          console.log(
            `${chalk.green('设置支持的浏览器:')} ${chalk.cyan(
              defaultBrowsers.join(', ')
            )}`
          );
          console.log();
        })
        // Swallow any error
        .catch(() => {})
        .then(() => checkBrowsers(dir, isInteractive, false))
    );
  });
}

module.exports = { defaultBrowsers, checkBrowsers };
