#thinglator-driver-hue-light

Allows the Thinglator platform to control Philips Hue lights on your local network.

## Requirements

* node.js
* Thinglator - https://github.com/richardwillars/thinglator
* Active Internet connection - Ethernet or WiFi (it uses HTTP to talk to the Philips Hue servers)

## Installation for usage

Navigate to the root of your Thinglator installation and run:

> yarn add thinglator-driver-hue-light
> yarn dev

# Installation for development

Navigate to the root of the thinglator-driver-hue-light project and run:

> yarn install
> yarn link

Navigate to the root of your Thinglator installation and run:

> yarn add thinglator-driver-hue-light

Go to the thinglator project and run:

> yarn link thinglator-driver-hue-light

This will point thinglator/node_modules/thinglator-driver-hue-light to the directory where you just installed thinglator-driver-hue-light. This makes it easier for development and testing of the module.

> yarn dev

## Test

> yarn test
> or
> yarn test:watch
