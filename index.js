const hue = require('node-hue-api');
const HueApi = require('node-hue-api').HueApi;

const bulbCommands = {
    'Extended color light': {
        setHSBState: true,
        setBrightnessState: true,
        setBooleanState: true
    },
    'Dimmable light': {
        setBrightnessState: true,
        setBooleanState: true
    },
    'Color temperature light': {
        setBrightnessState: true,
        setBooleanState: true
    }
};

class HueLightDriver {
    constructor() {
        this.driverSettings = {
            user: null,
            bridgeAddress: null
        };
        this.nodeIdCache = {};
        this.commsInterface = null;
        this.authenticatedHueApi = null;
    }
    init(driverSettingsObj, commsInterface, eventEmitter) {
        this.driverSettingsObj = driverSettingsObj;

        this.eventEmitter = eventEmitter;
        this.commsInterface = commsInterface;

        return this.driverSettingsObj.get().then((settings) => {
            this.driverSettings = settings;
            if ((this.driverSettings.user) && (this.driverSettings.bridgeAddress)) {
                this.authenticatedHueApi = new HueApi(this.driverSettings.bridgeAddress, this.driverSettings.user);
            }
        });
    }


    getName() {
        return 'hue-light';
    }

    getType() {
        return 'light';
    }

    getInterface() {
        return 'http';
    }

    getEventEmitter() {
        return this.eventEmitter;
    }

    initDevices() {

    }

    getAuthenticationProcess() {
        return [{
            type: 'ManualAction',
            message: 'In order to use Philips Hue bulbs you must press the button on your Philips Hue bridge.'
        }];
    }

    setAuthenticationStep0() {
        const hueApi = new HueApi();
        let bridgeAddress = null;
        return hue.nupnpSearch().then((bridges) => {
            if (!bridges[0]) {
                const e = new Error('Unable to find the Philips Hue bridge on your network');
                e.type = 'Connection';
                throw e;
            }
            bridgeAddress = bridges[0].ipaddress;
            return hueApi.registerUser(bridges[0].ipaddress, 'Thinglator hue-light driver');
        }).then((newUser) => {
            this.driverSettings.user = newUser;
            this.driverSettings.bridgeAddress = bridgeAddress;
            this.authenticatedHueApi = new HueApi(this.driverSettings.bridgeAddress, this.driverSettings.user);
            return this.driverSettingsObj.set(this.driverSettings);
        }).then(() => ({
            success: true
        })).catch(err => ({
            success: false,
            message: err.message
        }));
    }

    checkAuthenticated() {
        return new Promise((resolve, reject) => {
            if ((this.driverSettings.user === null) || (this.driverSettings.bridgeAddress === null)) {
                const err = new Error('Not authenticated');
                err.type = 'Authentication';
                reject(err);
            } else {
                resolve(true);
            }
        });
    }

    discover() {
        return this.checkAuthenticated().then(() => this.authenticatedHueApi.lights()).then((response) => {
            const devices = [];
            if (response.lights) {
                response.lights.forEach((light) => {
                    let commands = {};
                    if (bulbCommands[light.type]) {
                        commands = bulbCommands[light.type];
                    }
                    const device = {
                        deviceId: light.id,
                        name: light.name,
                        commands
                    };
                    devices.push(device);
                });
            }
            return devices;
        })
        .catch((err) => {
            const newErr = err;
            newErr.type = 'Authentication';
            throw newErr;
        });
    }

    translateFromDriverHue(val) {
        // comes in the scale 0-65535. Needs to be 0-360
        if (!val) {
            return 0;
        }
        return parseInt((val / 65535) * 360, 10);
    }

    translateToDriverHue(val) {
        // comes in the scale 0-360. Needs to be 0-65535
        return parseInt((val / 360) * 65535, 10);
    }

    translateFromDriverBrightness(val) {
        // comes in the scale 0-255. Needs to be 0-1
        return val / 255;
    }

    translateToDriverBrightness(val) {
        // comes in the scale 0-1. Needs to be 0-255
        return parseInt(val * 255, 10);
    }

    translateFromDriverSaturation(val) {
        // comes in the scale 0-255. Needs to be 0-1
        if (!val) {
            return 0;
        }
        return val / 255;
    }

    translateToDriverSaturation(val) {
        // comes in the scale 0-1. Needs to be 0-255
        return parseInt(val * 255, 10);
    }

    translateToDriverDuration(val) {
        return parseInt(val * 10, 10);
    }

    command_setHSBState(device, props) { // eslint-disable-line camelcase
        const state = {
            on: true,
            bri: this.translateToDriverBrightness(props.colour.brightness),
            sat: this.translateToDriverSaturation(props.colour.saturation),
            hue: this.translateToDriverHue(props.colour.hue),
            transitiontime: this.translateToDriverDuration(props.duration)
        };

        return this.authenticatedHueApi.setLightState(device.specs.deviceId, state)
            .then(() => this.authenticatedHueApi.lightStatus(device.specs.deviceId)).then((lightState) => {
                const newLightState = {
                    on: lightState.state.on,
                    colour: {
                        hue: this.translateFromDriverHue(lightState.state.hue),
                        saturation: this.translateFromDriverSaturation(lightState.state.sat),
                        brightness: this.translateFromDriverBrightness(lightState.state.bri)
                    }
                };

                this.eventEmitter.emit('state', 'hue-light', device._id, newLightState);
            })
            .catch((e) => {
                let err;
                if (!e.type) {
                    err = new Error(e.error);
                    err.type = 'Device';
                } else {
                    err = e;
                }
                throw err;
            });
    }

    command_setBrightnessState(device, props) { // eslint-disable-line camelcase
        const state = {
            on: true,
            bri: this.translateToDriverBrightness(props.colour.brightness),
            transitiontime: this.translateToDriverDuration(props.duration)
        };

        return this.authenticatedHueApi.setLightState(device.specs.deviceId, state)
            .then(() => this.authenticatedHueApi.lightStatus(device.specs.deviceId)).then((lightState) => {
                const newLightState = {
                    on: lightState.state.on,
                    colour: {
                        hue: this.translateFromDriverHue(lightState.state.hue),
                        saturation: this.translateFromDriverSaturation(lightState.state.sat),
                        brightness: this.translateFromDriverBrightness(lightState.state.bri)
                    }
                };
                this.eventEmitter.emit('state', 'hue-light', device._id, newLightState);
            })
            .catch((e) => {
                let err;
                if (!e.type) {
                    err = new Error(e.error);
                    err.type = 'Device';
                } else {
                    err = e;
                }
                throw err;
            });
    }

    command_setBooleanState(device, props) { // eslint-disable-line camelcase
        const state = {
            on: props.on,
            transitiontime: this.translateToDriverDuration(props.duration)
        };

        return this.authenticatedHueApi.setLightState(device.specs.deviceId, state)
            .then(() => this.authenticatedHueApi.lightStatus(device.specs.deviceId)).then((lightState) => {
                const newLightState = {
                    on: lightState.state.on,
                    colour: {
                        hue: this.translateFromDriverHue(lightState.state.hue),
                        saturation: this.translateFromDriverSaturation(lightState.state.sat),
                        brightness: this.translateFromDriverBrightness(lightState.state.bri)
                    }
                };

                this.eventEmitter.emit('state', 'hue-light', device._id, newLightState);
            })
            .catch((e) => {
                let err;
                if (!e.type) {
                    err = new Error(e.error);
                    err.type = 'Device';
                } else {
                    err = e;
                }
                throw err;
            });
    }
}

module.exports = HueLightDriver;
