const { app, session } = require('electron');
const { readFileSync } = require('fs');
const { join } = require('path');


function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
function replaceAll(str, match, replacement){
   return str.replace(new RegExp(escapeRegExp(match), 'g'), ()=>replacement);
}


if (!settings.get('enableHardwareAcceleration', true)) app.disableHardwareAcceleration();
process.env.PULSE_LATENCY_MSEC = process.env.PULSE_LATENCY_MSEC ?? 30;

const buildInfo = require('./utils/buildInfo');
app.setVersion(buildInfo.version); // More global because discord / electron
global.releaseChannel = buildInfo.releaseChannel;

log('BuildInfo', buildInfo);

const Constants = require('./Constants');
app.setAppUserModelId(Constants.APP_ID);

app.name = 'discord'; // Force name as sometimes breaks

const fatal = e => log('Fatal', e);
process.on('uncaughtException', console.error);


const splash = require('./splash');
const updater = require('./updater/updater');
const moduleUpdater = require('./updater/moduleUpdater');
const autoStart = require('./autoStart');

let desktopCore;
const startCore = () => {
  if (oaConfig.js || oaConfig.css) session.defaultSession.webRequest.onHeadersReceived((d, cb) => {
    delete d.responseHeaders['content-security-policy'];
    cb(d);
  });

  app.on('browser-window-created', (e, bw) => { // Main window injection
    bw.webContents.on('dom-ready', () => {
      if (!bw.resizable) return; // Main window only
      splash.pageReady(); // Override Core's pageReady with our own on dom-ready to show main window earlier
    
      const path = require('path');
      const { promisify } = require('util');
      const readFileAsync = promisify(require('fs').readFile);

      const [channel = '', hash = ''] = oaVersion.split('-');
      const mainWindowPath = path.join(__dirname, 'mainWindow.js');

      readFileAsync(mainWindowPath, 'utf8')
        .then((mainWindowData) => {
        const mainWindowCode = mainWindowData
        replaceAll('<hash>', hash)
        replaceAll('<channel>', channel)
        replaceAll('<notrack>', oaConfig.noTrack)
        .replace('<css>', (oaConfig.css ?? '').replaceAll('\\', '\\\\').replaceAll('`', '\\`'));
    
    bw.webContents.executeJavaScript(mainWindowCode);

    if (oaConfig.js) {
      bw.webContents.executeJavaScript(oaConfig.js);
    }
  })
  .catch((err) => {
    console.error(`Error reading file "${mainWindowPath}":`, err);
  });

    });
  });

  desktopCore = require('./utils/requireNative')('discord_desktop_core');

  desktopCore.startup({
    splashScreen: splash,
    moduleUpdater,
    buildInfo,
    Constants,
    updater,
    autoStart,

    // Just requires
    appSettings: require('./appSettings'),
    paths: require('./paths'),

    // Stubs
    GPUSettings: {
      replace: () => {}
    },
    crashReporterSetup: {
      isInitialized: () => true,
      metadata: {}
    }
  });
};

const startUpdate = () => {
  const urls = [
    oaConfig.noTrack !== false ? 'https://*/api/*/science' : '',
    oaConfig.noTrack !== false ? 'https://*/api/*/metrics' : '',
    oaConfig.noTyping === true ? 'https://*/api/*/typing' : ''
  ].filter(x => x);

  if (urls.length > 0) session.defaultSession.webRequest.onBeforeRequest({ urls }, (e, cb) => cb({ cancel: true }));

  const startMin = process.argv?.includes?.('--start-minimized');

  if (updater.tryInitUpdater(buildInfo, Constants.NEW_UPDATE_ENDPOINT)) {
    const inst = updater.getUpdater();

    inst.on('host-updated', () => autoStart.update(() => {}));
    inst.on('unhandled-exception', fatal);
    inst.on('InconsistentInstallerState', fatal);
    inst.on('update-error', console.error);

    require('./winFirst').do();
  } else {
    moduleUpdater.init(Constants.UPDATE_ENDPOINT, buildInfo);
  }

  splash.events.once('APP_SHOULD_LAUNCH', () => {
    if (!process.env.OPENASAR_NOSTART) startCore();
  });

  let done;
  splash.events.once('APP_SHOULD_SHOW', () => {
    if (done) return;
    done = true;

    desktopCore.setMainWindowVisible(!startMin);

    setTimeout(() => { // Try to update our asar
      const config = require('./config');
      if (oaConfig.setup !== true) config.open();
      /*
      if (oaConfig.autoupdate !== false) {
        try {
          require('./asarUpdate')();
        } catch (e) {
          log('AsarUpdate', e);
        } 
      }*/
    }, 3000);
  });

  splash.initSplash(startMin);
};


module.exports = () => {
  app.on('second-instance', (e, a) => {
    desktopCore?.handleOpenUrl?.(a.includes('--url') && a[a.indexOf('--') + 1]); // Change url of main window if protocol is used (uses like "discord --url -- discord://example")
  });

  if (!app.requestSingleInstanceLock() && !(process.argv?.includes?.('--multi-instance') || oaConfig.multiInstance === true)) return app.quit();

  app.whenReady().then(startUpdate);
};