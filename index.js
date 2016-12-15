'use strict';

var hue = require('node-hue-api');
var HueApi = require("node-hue-api").HueApi;

var bulbCapabilities = {
    'Extended color light': {
        setHSBState: true,
        setBrightnessState: true,
        setBooleanState: true
    },
    'Dimmable light': {
        setBrightnessState: true,
        setBooleanState: true
    }
};

class HueLightDriver {
    constructor(driverSettingsObj, interfaces) {
        var self = this;
        this.authenticatedHueApi = null;
        this.driverSettingsObj = driverSettingsObj;

        this.driverSettings = {
            user: null,
            bridgeAddress: null
        };

        this.driverSettingsObj.get().then(function(settings) {
            self.driverSettings = settings;
            if((self.driverSettings.user) && (self.driverSettings.bridgeAddress)) {
                self.authenticatedHueApi = new HueApi(self.driverSettings.bridgeAddress, self.driverSettings.user);
            }
        });

        this.interface = interfaces[this.getInterface()];
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

    setEventEmitter(eventEmitter) {
        this.eventEmitter = eventEmitter;
    }

    initDevices(devices) {

    }

    _buildColourString(hue, sat, bri) {
        return 'hue:' + hue + ' saturation:' + sat + ' brightness:' + bri;
    }

    getAuthenticationProcess() {
        return [{
            type: 'PhysicalAction',
            message: 'In order to use Philips Hue bulbs you must press the button on your Philips Hue bridge.',
            next: {
                http: '/authenticate/light/hue-light/0',
                socket: {
                    event: 'authenticationStep',
                    step: 0
                }
            }
        }];
    }

    setAuthenticationStep0(props) {
        var self = this;
        var hueApi = new HueApi();
        var bridgeAddress = null;
        return hue.nupnpSearch().then(function(bridges) {
            if(!bridges[0]) {
                var e = new Error('Unable to find the Philips Hue bridge on your network');
                e.type = 'Connection';
                throw e;
            }
            bridgeAddress = bridges[0].ipaddress;
            return hueApi.registerUser(bridges[0].ipaddress, 'Thinglator hue light driver');
        }).then(function(newUser) {
            self.driverSettings.user = newUser;
            self.driverSettings.bridgeAddress = bridgeAddress;
            self.authenticatedHueApi = new HueApi(self.driverSettings.bridgeAddress, self.driverSettings.user);
            return self.driverSettingsObj.set(self.driverSettings);
        }).then(function() {
            return {
                "success": true
            };
        }).catch(function(err) {
            return {
                "success": false,
                "message": err.message
            };
        });
    }

    _checkAuthenticated() {
        return new Promise((resolve,reject) => {
            if((this.driverSettings.user===null) || (this.driverSettings.bridgeAddress===null)) {
                var err = new Error('Not authenticated');
                err.type = 'Authentication';
                reject(err);
            }
            else {
                resolve(true);
            }
        });
    }

    discover() {
        var self = this;
        return this._checkAuthenticated().then(function() {
            return self.authenticatedHueApi.lights();
        }).then(function(response) {
            var devices = [];   
            if(response.lights) {
                for (var i in response.lights) {
                    let capabilities = {};
                    if(bulbCapabilities[response.lights[i].type]) {
                        capabilities = bulbCapabilities[response.lights[i].type];
                    }
                    var device = {
                        deviceId: response.lights[i].id,
                        name: response.lights[i].name,
                        capabilities: capabilities
                    };
                    devices.push(device);
                }
            }
            return devices;
        })
        .catch(function(err) {
            err.type = 'Authentication';
            throw err;
        });
    }
    _translateFromDriverHue(val) {
        //comes in the scale 0-65535. Needs to be 0-360
        if(!val) {
            return null;
        }
        return parseInt((val/65535)*360);
    }
    _translateToDriverHue(val) {
        //comes in the scale 0-360. Needs to be 0-65535
        return parseInt((val/360)*65535);
    }
    _translateFromDriverBrightness(val) {
        //comes in the scale 0-255. Needs to be 0-1
        return val / 255;
    }
    _translateToDriverBrightness(val) {
        //comes in the scale 0-1. Needs to be 0-255
        return parseInt(val * 255);
    }
    _translateFromDriverSaturation(val) {
        //comes in the scale 0-255. Needs to be 0-1
        if(!val) {
            return null;
        }
        return val / 255
    }
    _translateToDriverSaturation(val) {
        //comes in the scale 0-1. Needs to be 0-255
        return parseInt(val * 255);
    }
    _translateToDriverDuration(val) {
        return parseInt(val*10);
    }
    capability_setHSBState(device, props) {
        var self = this;
        var state = {
            on: true,
            bri: self._translateToDriverBrightness(props.colour.brightness),
            sat: self._translateToDriverSaturation(props.colour.saturation),
            hue: self._translateToDriverHue(props.colour.hue),
            transitiontime: self._translateToDriverDuration(props.duration)
        };

        return self.authenticatedHueApi.setLightState(device.specs.deviceId, state)
            .then(function() {
                return self.authenticatedHueApi.lightStatus(device.specs.deviceId);
            }).then(function(lightState) {
                var newLightState = {
                    on: lightState.state.on,
                    colour: {
                        hue: self._translateFromDriverHue(lightState.state.hue),
                        saturation: self._translateFromDriverSaturation(lightState.state.sat),
                        brightness: self._translateFromDriverBrightness(lightState.state.bri)
                    }
                };

                return newLightState;
            })
            .catch(function(e) {
                if (!e.type) {
                    var err = new Error(e.error);
                    err.type = 'Device';
                }
                else {
                    var err = e;
                }
                throw err;
            });
    }

    capability_setBrightnessState(device, props) {
        var self = this;
        var state = {
            on: true,
            bri: self._translateToDriverBrightness(props.colour.brightness),
            transitiontime: self._translateToDriverDuration(props.duration)
        };

        return self.authenticatedHueApi.setLightState(device.specs.deviceId, state)
            .then(function() {
                return self.authenticatedHueApi.lightStatus(device.specs.deviceId);
            }).then(function(lightState) {
                var newLightState = {
                    on: lightState.state.on,
                    colour: {
                        hue: self._translateFromDriverHue(lightState.state.hue),
                        saturation: self._translateFromDriverSaturation(lightState.state.sat),
                        brightness: self._translateFromDriverBrightness(lightState.state.bri)
                    }
                };

                return newLightState;
            })
            .catch(function(e) {
                if (!e.type) {
                    var err = new Error(e.error);
                    err.type = 'Device';
                }
                else {
                    var err = e;
                }
                throw err;
            });
    }

    capability_setBooleanState(device, props) {
        var self = this;
        var state = {
            on: props.on,
            transitiontime: self._translateToDriverDuration(props.duration)
        };

        return self.authenticatedHueApi.setLightState(device.specs.deviceId, state)
            .then(function() {
                return self.authenticatedHueApi.lightStatus(device.specs.deviceId);
            }).then(function(lightState) {
                var newLightState = {
                    on: lightState.state.on,
                    colour: {
                        hue: self._translateFromDriverHue(lightState.state.hue),
                        saturation: self._translateFromDriverSaturation(lightState.state.sat),
                        brightness: self._translateFromDriverBrightness(lightState.state.bri)
                    }
                };

                return newLightState;
            })
            .catch(function(e) {
                if (!e.type) {
                    var err = new Error(e.error);
                    err.type = 'Device';
                }
                else {
                    var err = e;
                }
                throw err;
            });
    }
}

module.exports = HueLightDriver;