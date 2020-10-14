node-red-contrib-johnny5
========================

A set of input and output nodes for controlling **General Purpose Input and Outputs (GPIOs)** though the use of [Johnny-Five](https://github.com/rwaldron/johnny-five) [I/O Plugins](https://github.com/rwaldron/johnny-five/wiki/IO-Plugins) as well as running **Johnny-Five scripts**!

* Support for NodeJS 12 and serialport 8.
* Johnny-Five 1.3

This is a fork of [monteslu/node-red-contrib-gpio](https://github.com/monteslu/node-red-contrib-gpio)

## Install via Node-RED Palette Manager

Search for *node-red-contrib-johnny5*

## Install via NPM

From inside your node-red directory:
```
npm install node-red-contrib-johnny5
```

## Control I/O for Analog, Digital, PWM and Servos

![input output](in_out.png)

## Read and Write I2C devices
![i2c](i2c.png)

## Full Johnny-Five script support!

![scriptnode](scriptnode.png)

## Supported Hardware

node-red-contrib-johnny5 supports several Johnny-Five I/O classes:

| Device | IO Plugin |
|----------|-------------|
|Arduino/Firmata|[firmata](https://github.com/jgautier/firmata)|
|Raspberry Pi|[raspi-io](https://github.com/bryan-m-hughes/raspi-io)|
|BeagleBone Black, Green, Pocket|[beaglebone-io](https://github.com/julianduque/beaglebone-io)|
|C.H.I.P.|[chip-io](https://github.com/sandeepmistry/node-chip-io)|
|Galileo/Edison|[galileo-io](https://github.com/rwaldron/galileo-io/)|
|Blend Micro|[blend-micro-io](https://github.com/noopkat/blend-micro-io)|
|LightBlue Bean|[bean-io](https://github.com/monteslu/bean-io/)|
|ble-io(esp32, curie)|[ble-io](https://github.com/monteslu/ble-io/)|
|Circuit Playground(classic)|[playground-io](https://github.com/rwaldron/playground-io)|
|Electirc Imp|[imp-io](https://github.com/rwaldron/imp-io/)|
|Particle(Spark) Core|[particle-io](https://github.com/rwaldron/particle-io/)|
|Odroid C2|[odroid-io](https://github.com/racerxdl/odroid-io/)|


Arduino is supported out of the box, but for other devices, you'll need to install their IO plugin.

For example to install the Raspberry Pi plugin:

```
npm install raspi-io
```

## How to use

Please see the embedded examples.

![examples_import](examples_import.png)

## Remote Arduino Support

If you're using Arduino/Firmata, you can connect to a remote device via a raw tcp socket, or an MQTT connection.

For example, if you wanted to connect using tcp, in node-red you could specify an ip and port.  On another machine with an Arduino plugged in you could run a server that relays a tcp socket to a serial port such as: [tcpSerialRelay.js](https://gist.github.com/monteslu/b5ad4c46c9b6b78f7aea)

If you wanted to connect an Arduino to an MQTT server you can use a script such as: [bindSerialToMQTT.js](https://gist.github.com/monteslu/64372bcdff6f56458ec6).  In node-red you can connect to the same MQTT server and subscribe to the topic the arduino is publishing on, while publishing to the topic that the arduino is subscribed to.
