const { app } = require('electron');

const presets = {
  'base': '--autoplay-policy=no-user-gesture-required --disable-features=WinRetrieveSuggestionsOnlyOnDemand,HardwareMediaKeyHandling,MediaSessionService', // Base Discord
  'perf': `--autoplay-policy=no-user-gesture-required --disable-features=WinRetrieveSuggestionsOnlyOnDemand,HardwareMediaKeyHandling,MediaSessionService`, // Performance settings patched out due to blank screen issue
  'battery': '--enable-features=TurnOffStreamingMediaCachingOnBattery --force_low_power_gpu' // Known to have better battery life for Chromium?
};


module.exports = () => {
  let c = {};
  for (const x of ('base,' + (oaConfig.cmdPreset || 'perf')).split(',').reduce((a, x) => a.concat(presets[x]?.split(' ')), [])) {
    if (!x) continue;
    const [ k, v ] = x.split('=');

    (c[k] = c[k] || []).push(v);
  }

  for (const k in c) {
    app.commandLine.appendSwitch(k.replace('--', ''), c[k].join(','));
  }
};