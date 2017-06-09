/* eslint-disable new-cap, no-unused-expressions, no-undef, global-require */
const chai = require('chai');
const mockery = require('mockery');
const driverTests = require('thinglator/utils/testDriver');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const expect = chai.expect;
chai.use(sinonChai);

const driverName = 'hue-light';
const driverType = 'light';
const driverInterface = 'http';


describe('Hue', () => {
    const hueMock = {
        HueApi: class HueApi {
            registerUser() {
                return Promise.resolve({});
            }
            lights() {
                return Promise.resolve([]);
            }
            setLightState() {
                return Promise.resolve();
            }
            lightStatus() {
                return Promise.resolve({});
            }
        },
        nupnpSearch: sinon.stub().returns(Promise.resolve())

    };

    mockery.enable({
        useCleanCache: true,
        warnOnUnregistered: false
    });

    mockery.registerMock('node-hue-api', hueMock);
    const Driver = require('../index');

    driverTests(driverName, Driver, driverType, driverInterface, expect);
});
