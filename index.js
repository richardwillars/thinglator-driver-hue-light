const hue = require('node-hue-api');
const driver = require('./driver');

module.exports = {
  initialise: (settings, updateSettings, commsInterface, events, createEvent) => driver(settings, updateSettings, commsInterface, hue, events, createEvent),
  driverType: 'light',
  interface: 'http',
  driverId: 'thinglator-driver-hue-light',
};
