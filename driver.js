let globalAuthenticatedHueApi = null;
let globalSettings = {};

const bulbCommands = {
  'Extended color light': {
    setHSBState: true,
    setBrightnessState: true,
    setBooleanState: true,
  },
  'Dimmable light': {
    setBrightnessState: true,
    setBooleanState: true,
  },
  'Color temperature light': {
    setBrightnessState: true,
    setBooleanState: true,
  },
};

const translateFromDriverHue = (val) => {
  // comes in the scale 0-65535. Needs to be 0-360
  if (!val) {
    return 0;
  }
  return parseInt((val / 65535) * 360, 10);
};

const translateToDriverHue = val =>
  // comes in the scale 0-360. Needs to be 0-65535
  parseInt((val / 360) * 65535, 10);

const translateFromDriverBrightness = val =>
  // comes in the scale 0-255. Needs to be 0-1
  val / 255;

const translateToDriverBrightness = val =>
  // comes in the scale 0-1. Needs to be 0-255
  parseInt(val * 255, 10);

const translateFromDriverSaturation = (val) => {
  // comes in the scale 0-255. Needs to be 0-1
  if (!val) {
    return 0;
  }
  return val / 255;
};

const translateToDriverSaturation = val =>
  // comes in the scale 0-1. Needs to be 0-255
  parseInt(val * 255, 10);

const translateToDriverDuration = val => parseInt(val * 10, 10);

const initDevices = async () => {};

const checkAuthenticated = (authenticatedHueApi) => {
  if (authenticatedHueApi === null) {
    const err = new Error('Not authenticated');
    err.type = 'Authentication';
    throw err;
  }
  return true;
};

const discover = async (events, authenticatedHueApi) => {
  try {
    checkAuthenticated(authenticatedHueApi);
    const response = await authenticatedHueApi.lights();
    const devices = [];
    if (response.lights) {
      response.lights.forEach((light) => {
        let commands = {};
        if (bulbCommands[light.type]) {
          commands = bulbCommands[light.type];
        }
        const device = {
          originalId: light.id,
          name: light.name,
          commands,
          events: {
            [events.LIGHT_STATE]: true,
          },
        };
        devices.push(device);
      });
    }
    return devices;
  } catch (err) {
    const newErr = err;
    newErr.type = 'Authentication';
    throw newErr;
  }
};

const getAuthenticationProcess = () => [{
  type: 'ManualAction',
  message: 'In order to use Philips Hue bulbs you must press the button on your Philips Hue bridge.',
}];

const authenticationStep0 = async (props, getSettings, updateSettings, hue, unauthenticatedHueApi, HueApi) => {
  try {
    let bridgeAddress = null;
    const bridges = await hue.nupnpSearch();
    if (!bridges[0]) {
      const e = new Error('Unable to find the Philips Hue bridge on your network');
      e.type = 'Connection';
      throw e;
    }
    bridgeAddress = bridges[0].ipaddress;
    const newUser = await unauthenticatedHueApi.registerUser(bridges[0].ipaddress, 'Thinglator hue-light driver');
    const settings = await getSettings();
    settings.user = newUser;
    settings.bridgeAddress = bridgeAddress;
    globalAuthenticatedHueApi = new HueApi(settings.bridgeAddress, settings.user);
    await updateSettings(settings);
    globalSettings = settings;
    return {
      success: true,
    };
  } catch (err) {
    return {
      success: false,
      message: err.message,
    };
  }
};

const commandSetHSBState = async (device, props, authenticatedHueApi, events, createEvent) => {
  try {
    checkAuthenticated(authenticatedHueApi);
    const state = {
      on: true,
      bri: translateToDriverBrightness(props.colour.brightness),
      sat: translateToDriverSaturation(props.colour.saturation),
      hue: translateToDriverHue(props.colour.hue),
      transitiontime: translateToDriverDuration(props.duration),
    };

    await authenticatedHueApi.setLightState(device.specs.originalId, state);
    const lightState = await authenticatedHueApi.lightStatus(device.specs.originalId);
    const payload = {
      on: lightState.state.on,
      colour: {
        hue: translateFromDriverHue(lightState.state.hue),
        saturation: translateFromDriverSaturation(lightState.state.sat),
        brightness: translateFromDriverBrightness(lightState.state.bri),
      },
    };
    createEvent(events.LIGHT_STATE, device._id, payload);
  } catch (e) {
    let err;
    if (!e.type) {
      err = new Error(e.error);
      err.type = 'Device';
    } else {
      err = e;
    }
    throw err;
  }
};

const commandSetBrightnessState = async (device, props, authenticatedHueApi, events, createEvent) => {
  try {
    checkAuthenticated(authenticatedHueApi);
    const state = {
      on: true,
      bri: translateToDriverBrightness(props.colour.brightness),
      transitiontime: translateToDriverDuration(props.duration),
    };

    await authenticatedHueApi.setLightState(device.specs.originalId, state);
    const lightState = await authenticatedHueApi.lightStatus(device.specs.originalId);
    const payload = {
      on: lightState.state.on,
      colour: {
        hue: translateFromDriverHue(lightState.state.hue),
        saturation: translateFromDriverSaturation(lightState.state.sat),
        brightness: translateFromDriverBrightness(lightState.state.bri),
      },
    };
    createEvent(events.LIGHT_STATE, device._id, payload);
  } catch (e) {
    let err;
    if (!e.type) {
      err = new Error(e.error);
      err.type = 'Device';
    } else {
      err = e;
    }
    throw err;
  }
};

const commandSetBooleanState = async (device, props, authenticatedHueApi, events, createEvent) => {
  try {
    checkAuthenticated(authenticatedHueApi);
    const state = {
      on: props.on,
      transitiontime: translateToDriverDuration(props.duration),
    };

    await authenticatedHueApi.setLightState(device.specs.originalId, state);
    const lightState = await authenticatedHueApi.lightStatus(device.specs.originalId);
    const payload = {
      on: lightState.state.on,
      colour: {
        hue: translateFromDriverHue(lightState.state.hue),
        saturation: translateFromDriverSaturation(lightState.state.sat),
        brightness: translateFromDriverBrightness(lightState.state.bri),
      },
    };
    createEvent(events.LIGHT_STATE, device._id, payload);
  } catch (e) {
    let err;
    if (!e.type) {
      err = new Error(e.error);
      err.type = 'Device';
    } else {
      err = e;
    }
    throw err;
  }
};

module.exports = async (getSettings, updateSettings, commsInterface, hue, events, createEvent) => {
  const { HueApi } = hue;
  const unauthenticatedHueApi = new HueApi();
  globalSettings = await getSettings();
  if ((globalSettings.user) && (globalSettings.bridgeAddress)) {
    globalAuthenticatedHueApi = new HueApi(globalSettings.bridgeAddress, globalSettings.user);
  } else {
    globalSettings = { user: null, bridgeAddress: null };
    await updateSettings(globalSettings);
  }

  return {
    initDevices: devices => initDevices(devices),
    authentication_getSteps: getAuthenticationProcess,
    authentication_step0: props => authenticationStep0(props, getSettings, updateSettings, hue, unauthenticatedHueApi, HueApi),
    discover: () => discover(events, globalAuthenticatedHueApi),
    command_setHSBState: (device, props) => commandSetHSBState(device, props, globalAuthenticatedHueApi, events, createEvent),
    command_setBrightnessState: (device, props) => commandSetBrightnessState(device, props, globalAuthenticatedHueApi, events, createEvent),
    command_setBooleanState: (device, props) => commandSetBooleanState(device, props, globalAuthenticatedHueApi, events, createEvent),
  };
};
