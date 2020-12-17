const chalk = require('chalk');
const path = require('path');
const execSync = require('child_process').execSync;
const validateProjectName = require('validate-npm-package-name');
const fs = require('fs-extra');
const spawn = require('cross-spawn');
const os = require('os');
const semver = require('semver');
const dns = require('dns');

function createApp(name, verbose, template, by) {
  const root = path.resolve(name);
  const appName = path.basename(root);

  checkAppName(appName);
  fs.ensureDirSync(name);
  if (!isSafeToCreateProjectIn(root, name)) {
    process.exit(1);
  }
  console.log();

  console.log(`在 ${chalk.green(root)} 中创建一个新的React应用`);
  console.log();

  const packageJson = {
    name: appName,
    version: '0.1.0',
    private: true,
  };
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(packageJson, null, 2) + os.EOL
  );

  // 使用 npm 还是 yarn 去下载依赖
  const useYarn = by === 'yarn' ? false : shouldUseYarn();
  const originalDirectory = process.cwd();
  process.chdir(root);
  if (!useYarn && !checkThatNpmCanReadCwd()) {
    process.exit(1);
  }

  if (useYarn) {
    let yarnUsesDefaultRegistry = true;
    try {
      yarnUsesDefaultRegistry =
        execSync('yarnpkg config get registry').toString().trim() ===
        'https://registry.yarnpkg.com';
      if (yarnUsesDefaultRegistry) {
        fs.copySync(
          require.resolve('./yarn.lock.cached'),
          path.join(root, 'yarn.lock')
        );
      }
    } catch (e) {
      // ignore
    }
  }

  run(
    root,
    appName,
    verbose,
    originalDirectory,
    template,
    by,
  );
}

function run(
  root,
  appName,
  verbose,
  originalDirectory,
  template,
  by
) {
  const useYarn = by === 'yarn';
  const packageToInstall = 'react-scripts';
  const templateToInstall = template || 'cra-template';
  const allDependencies = ['react', 'react-dom', packageToInstall, templateToInstall];

  console.log('正在安装软件包，请稍等几分钟。');

  checkIfOnline(useYarn).then(isOnline => ({
    isOnline,
  })).then(({ isOnline }) => {
    console.log(
      `下载 ${chalk.cyan('react')}, ${chalk.cyan(
        'react-dom'
      )}, ${chalk.cyan(packageToInstall)} 和 ${chalk.cyan(templateToInstall)}...`
    );
    console.log();

    return install(
      root,
      by,
      allDependencies,
      verbose,
      isOnline
    );
  }).then(async () => {
    checkNodeVersion(packageToInstall);
    setCaretRangeForRuntimeDeps(templateToInstall);

    const nodeArgs = [];

    await executeNodeScript(
      {
        cwd: process.cwd(),
        args: nodeArgs,
      },
      [root, appName, verbose, originalDirectory, templateToInstall],
      `
    var init = require('${packageToInstall}/scripts/init.js');
    init.apply(null, JSON.parse(process.argv[1]));
  `
    );
  }).catch(reason => {
    console.log();
    console.log('中止安装。');
    if (reason.command) {
      console.log(`  ${chalk.cyan(reason.command)} 失败了。`);
    } else {
      console.log(
        chalk.red('未知bug：')
      );
      console.log(reason);
    }
    console.log();

    // On 'exit' we will delete these files from target directory.
    const knownGeneratedFiles = [
      'package.json',
      'yarn.lock',
      'node_modules',
    ];
    const currentFiles = fs.readdirSync(path.join(root));
    currentFiles.forEach(file => {
      knownGeneratedFiles.forEach(fileToMatch => {
        // This removes all knownGeneratedFiles.
        if (file === fileToMatch) {
          console.log(`删除生成的文件... ${chalk.cyan(file)}`);
          fs.removeSync(path.join(root, file));
        }
      });
    });
    const remainingFiles = fs.readdirSync(path.join(root));
    if (!remainingFiles.length) {
      // Delete target folder if empty
      console.log(
        `从 ${chalk.cyan(
          path.resolve(root, '..')
        )} 删除 ${chalk.cyan(`${appName}/`)}`
      );
      process.chdir(path.resolve(root, '..'));
      fs.removeSync(path.join(root));
    }
    console.log('完成。');
    process.exit(1);
  });
}

function install(root, by, dependencies, verbose, isOnline) {
  const useYarn = by === 'yarn';
  return new Promise(function (resolve, reject) {
    let command;
    let args;
    if (useYarn) {
      command = 'yarnpkg';
      args = ['add', '--exact'];
      if (!isOnline) {
        args.push('--offline');
      }
      [].push.apply(args, dependencies);

      // Explicitly set cwd() to work around issues like
      // https://github.com/facebook/create-react-app/issues/3326.
      // Unfortunately we can only do this for Yarn because npm support for
      // equivalent --prefix flag doesn't help with this issue.
      // This is why for npm, we run checkThatNpmCanReadCwd() early instead.
      args.push('--cwd');
      args.push(root);

      if (!isOnline) {
        console.log(chalk.yellow('你可能处于离线环境。'));
        console.log();
      }
    } else {
      command = by === 'tnpm' ? 'tnpm' : 'npm';
      args = [
        'install',
        '--save',
        '--save-exact',
        '--loglevel',
        'error',
      ].concat(dependencies);
    }

    if (verbose) {
      args.push('--verbose');
    }

    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('close', code => {
      if (code !== 0) {
        reject({
          command: `${command} ${args.join(' ')}`,
        });
        return;
      }
      resolve();
    });
  });
}

// 检查是否在线
function checkIfOnline(useYarn) {
  if (!useYarn) {
    // Don't ping the Yarn registry.
    // We'll just assume the best case.
    return Promise.resolve(true);
  }

  return new Promise(resolve => {
    dns.lookup('registry.yarnpkg.com', err => {
      let proxy;
      if (err != null && (proxy = getProxy())) {
        // If a proxy is defined, we likely can't resolve external hostnames.
        // Try to resolve the proxy name as an indication of a connection.
        dns.lookup(url.parse(proxy).hostname, proxyErr => {
          resolve(proxyErr == null);
        });
      } else {
        resolve(err == null);
      }
    });
  });
}

// 获取npm配置的代理
function getProxy() {
  if (process.env.https_proxy) {
    return process.env.https_proxy;
  } else {
    try {
      // Trying to read https-proxy from .npmrc
      let httpsProxy = execSync('npm config get https-proxy').toString().trim();
      return httpsProxy !== 'null' ? httpsProxy : undefined;
    } catch (e) {
      return;
    }
  }
}

// 检查依赖要求的Node版本是否符合
function checkNodeVersion(packageName) {
  const packageJsonPath = path.resolve(
    process.cwd(),
    'node_modules',
    packageName,
    'package.json'
  );

  if (!fs.existsSync(packageJsonPath)) {
    return;
  }

  const packageJson = require(packageJsonPath);
  if (!packageJson.engines || !packageJson.engines.node) {
    return;
  }

  if (!semver.satisfies(process.version, packageJson.engines.node)) {
    console.error(
      chalk.red(
        '当前Node版本为 %s.\n' +
          '创建React程序需要 %s 或更高 \n' +
          '请升级你的Node版本。'
      ),
      process.version,
      packageJson.engines.node
    );
    process.exit(1);
  }
}

// 确保依赖只固定主版本
function setCaretRangeForRuntimeDeps(packageName) {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = require(packagePath);

  if (typeof packageJson.dependencies === 'undefined') {
    console.error(chalk.red('package.json中缺少依赖项'));
    process.exit(1);
  }

  const packageVersion = packageJson.dependencies[packageName];
  if (typeof packageVersion === 'undefined') {
    console.error(chalk.red(`没有在package.json中发现 ${packageName}`));
    process.exit(1);
  }

  makeCaretRange(packageJson.dependencies, 'react');
  makeCaretRange(packageJson.dependencies, 'react-dom');

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + os.EOL);
}

// 确保依赖只固定主版本
function makeCaretRange(dependencies, name) {
  const version = dependencies[name];

  if (typeof version === 'undefined') {
    console.error(chalk.red(`package.json中缺少${name}依赖`));
    process.exit(1);
  }

  let patchedVersion = `^${version}`;

  if (!semver.validRange(patchedVersion)) {
    console.error(
      `无法修补依赖 ${name} 的版本，因为它的版本 ${chalk.red(
        version
      )} 会变成错误的版本 ${chalk.red(patchedVersion)}`
    );
    patchedVersion = version;
  }

  dependencies[name] = patchedVersion;
}

// 执行脚本
function executeNodeScript({ cwd, args }, data, source) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['-e', source, '--', JSON.stringify(data)],
      { ...args, cwd, stdio: 'inherit' }
    );

    child.on('close', code => {
      if (code !== 0) {
        reject({
          command: `node ${args.join(' ')}`,
        });
        return;
      }
      resolve();
    });
  });
}

// 检查项目名称是否合法
function checkAppName(appName) {
  const validationResult = validateProjectName(appName);
  if (!validationResult.validForNewPackages) {
    console.error(
      chalk.red(
        `不能创建一个项目名为 ${chalk.green(
          `"${appName}"`
        )} ，由于npm命名限制:\n`
      )
    );
    [
      ...(validationResult.errors || []),
      ...(validationResult.warnings || []),
    ].forEach(error => {
      console.error(chalk.red(`  * ${error}`));
    });
    console.error(chalk.red('\n请选择一个不同的项目名。'));
    process.exit(1);
  }

  const dependencies = ['react', 'react-dom', 'react-scripts'].sort();
  if (dependencies.includes(appName)) {
    console.error(
      chalk.red(
        `不能创建一个项目名为 ${chalk.green(
          `"${appName}"`
        )} ，因为有一个相同名称的依赖。\n` +
          `由于npm的工作方式，因此不允许使用以下名称：\n\n`
      ) +
        chalk.cyan(dependencies.map(depName => `  ${depName}`).join('\n')) +
        chalk.red('\n\n请选择一个不同的项目名。')
    );
    process.exit(1);
  }
}

// 是否已经生成过该项目
function isSafeToCreateProjectIn(root, name) {
  const validFiles = [
    '.DS_Store',
    '.git',
    '.gitattributes',
    '.gitignore',
    '.gitlab-ci.yml',
    '.hg',
    '.hgcheck',
    '.hgignore',
    '.idea',
    '.npmignore',
    '.travis.yml',
    'docs',
    'LICENSE',
    'README.md',
    'mkdocs.yml',
    'Thumbs.db',
  ];
  const errorLogFilePatterns = [
    'npm-debug.log',
    'yarn-error.log',
    'yarn-debug.log',
  ];

  const isErrorLog = file => {
    return errorLogFilePatterns.some(pattern => file.startsWith(pattern));
  };

  const conflicts = fs
    .readdirSync(root)
    .filter(file => !validFiles.includes(file))
    // IntelliJ IDEA creates module files before CRA is launched
    .filter(file => !/\.iml$/.test(file))
    // Don't treat log files from previous installation as conflicts
    .filter(file => !isErrorLog(file));

  if (conflicts.length > 0) {
    console.log(
      `文件夹 ${chalk.green(name)} 中包含可能冲突的文件：`
    );
    console.log();
    for (const file of conflicts) {
      try {
        const stats = fs.lstatSync(path.join(root, file));
        if (stats.isDirectory()) {
          console.log(`  ${chalk.blue(`${file}/`)}`);
        } else {
          console.log(`  ${file}`);
        }
      } catch (e) {
        console.log(`  ${file}`);
      }
    }
    console.log();
    console.log(
      '尝试使用新的目录名称，或删除上面列出的文件。'
    );

    return false;
  }

  // Remove any log files from a previous installation.
  fs.readdirSync(root).forEach(file => {
    if (isErrorLog(file)) {
      fs.removeSync(path.join(root, file));
    }
  });
  return true;
}

// 检查当前环境里是否有yarn
function shouldUseYarn() {
  try {
    execSync('yarnpkg --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
}

// 检查npm在当前目录下是否能正确的使用
function checkThatNpmCanReadCwd() {
  const cwd = process.cwd();
  let childOutput = null;
  try {
    // Note: intentionally using spawn over exec since
    // the problem doesn't reproduce otherwise.
    // `npm config list` is the only reliable way I could find
    // to reproduce the wrong path. Just printing process.cwd()
    // in a Node process was not enough.
    childOutput = spawn.sync('npm', ['config', 'list']).output.join('');
  } catch (err) {
    // Something went wrong spawning node.
    // Not great, but it means we can't do this check.
    // We might fail later on, but let's continue.
    return true;
  }
  if (typeof childOutput !== 'string') {
    return true;
  }
  const lines = childOutput.split('\n');
  // `npm config list` output includes the following line:
  // "; cwd = C:\path\to\current\dir" (unquoted)
  // I couldn't find an easier way to get it.
  const prefix = '; cwd = ';
  const line = lines.find(line => line.startsWith(prefix));
  if (typeof line !== 'string') {
    // Fail gracefully. They could remove it.
    return true;
  }
  const npmCWD = line.substring(prefix.length);
  if (npmCWD === cwd) {
    return true;
  }
  console.error(
    chalk.red(
      `无法在正确的目录中启动npm进程。\n\n` +
        `当前目录是：${chalk.bold(cwd)}\n` +
        `但是，新启动的npm进程在：${chalk.bold(
          npmCWD
        )}\n\n` +
        `这可能是由于系统终端的配置错误引起的。`
    )
  );
  if (process.platform === 'win32') {
    console.error(
      chalk.red(`在Windows上，通常可以通过运行来解决此问题：\n\n`) +
        `  ${chalk.cyan(
          'reg'
        )} delete "HKCU\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n` +
        `  ${chalk.cyan(
          'reg'
        )} delete "HKLM\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n\n` +
        chalk.red(`尝试在终端中运行以上两行。\n`)
    );
  }
  return false;
}

module.exports = createApp;
