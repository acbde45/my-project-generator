const program = require('commander');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const envinfo = require('envinfo');

const packageJson = require(path.resolve(__dirname, '../package.json'));

const execute = async (cmd) => {
    const script = `./scripts/${cmd}.js`
    try {
        await fs.access(path.resolve(__dirname, script))
    } catch (e) {
        throw chalk.red(`"doc-scripts ${cmd}" is invalid command.`)
    }
    try {
        await require(script)()
    } catch (e) {
        throw e && (e.stack || e.message) ? (e.stack ? e.stack : e.message) : e
    }
}


function command() {
  program
    .option('--info', '打印环境调试信息')
    .arguments('[script]')
    .action(async (script, cmd) => {
      try {
        if (program.info) {
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
        await execute(script);
      } catch (e) {
        console.log(e);
      }
    });
  program.parse(process.argv);
}

module.exports = {
  command,
};
