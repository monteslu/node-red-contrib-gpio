/*

The MIT License (MIT)
=====================

Copyright (c) 2015 Luis Montes

Copyright (c) 2019 Holger Reichert <mail@h0lger.de>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

/* eslint no-console: ["off"] */

'use strict';

const five = require('johnny-five');
const firmata = require('firmata');
const net = require('net');

function createNode(RED) {
  function start(node, n) {
    if (node.io) {
      node.io.on('connect', () => {
        node.emit('networkReady', node.io);
      });
      node.board = new five.Board({
        io: node.io, id: node.id, repl: false, timeout: 2e4,
      });
      node.board.on('ready', () => {
        if (RED.settings.verbose) { node.log('io ready'); }
        process.nextTick(() => {
          node.emit('ioready', node.io);
        });
        // set sampling interval
        const samplingInterval = parseInt(n.samplingInterval, 10) || 500;
        try { node.io.setSamplingInterval(samplingInterval); } catch (exp) { console.log(exp); }
      });

      node.board.on('error', node.error.bind(node));
      node.on('close', (done) => {
        if (RED.settings.verbose) { node.log('closing ioplugin'); }
        try {
          if (node.tcpServer) {
            try {
              node.tcpServer.close();
            } catch (exp) {
              node.error(exp);
            }
          }

          if (node.io && node.io.close) {
            node.io.close();
          } else if (node.io && node.io.sp) {
            if (node.io.sp.close) {
              node.io.sp.close();
            } else if (node.io.sp.end) {
              node.io.sp.end();
            }
          }

          if (node.client && node.client.stop) {
            node.client.stop();
          }
          if (node.client && node.client.close) {
            node.client.close();
          }

          const cachedBoards = [];
          five.Board.cache.forEach(() => {
            five.Board.cache.pop();
          });

          cachedBoards.forEach((board) => {
            if (board !== node.board) {
              five.Board.cache.push(board);
            }
          });

          // try and cleanup board
          node.board.register.forEach((component) => {
            try {
              if (component.stop) {
                component.stop();
              } else if (component.state && component.state.intervalId) {
                clearInterval(component.state.intervalId);
              } else if (component.state && component.state.interval) {
                clearInterval(component.state.interval);
              }
              component.io = null;
              component.board = null;
            } catch (compE) {
              console.log('error trying to cleanup component', compE);
            }
          });
          node.board.io = null;

          done();
          if (RED.settings.verbose) { node.log('port closed'); }
        } catch (exp) {
          console.log('error closing', exp);
          done();
        }
      });
    } else {
      node.emit('ioError', 'invalid IO class');
    }
  }

  function iopluginNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;

    let boardModule; let sp; let VirtualSerialPort; var
      client;
    try {
      boardModule = require(n.boardType);
      node.boardModule = boardModule;
    } catch (exp) {
      node.log('error loading io class', n.boardType, exp);
      process.nextTick(() => {
        node.emit('ioError', exp);
      });
      return;
    }

    if (n.boardType === 'playground-io') {
      try {
        node.io = new boardModule({ port: n.serialportName, serialport: { baudRate: 57600, bufferSize: 256, lock: false }, reportVersionTimeout: 200 });
        start(node, n);
      } catch (exp) {
        process.nextTick(() => {
          node.emit('ioError', exp);
        });
      }
    } else if (n.boardType === 'firmata') {
      if (n.connectionType === 'local') {
        try {
          node.io = new firmata.Board(n.serialportName, { serialport: { baudRate: 57600, bufferSize: 256, lock: false } });
          start(node, n);
        } catch (exp) {
          process.nextTick(() => {
            node.emit('ioError', exp);
          });
        }
      } else if (n.connectionType === 'mqtt') {
        try {
          const mqtt = require('mqtt');
          VirtualSerialPort = require('mqtt-serial').SerialPort;

          client = mqtt.connect(n.mqttServer,
            { username: n.username, password: n.password });
          client.on('error', (err) => {
            node.warn(err);
          });

          sp = new VirtualSerialPort({
            client,
            transmitTopic: n.pubTopic,
            receiveTopic: n.subTopic,
          });

          node.io = new firmata.Board(sp, { samplingInterval: 500, reportVersionTimeout: 15000 });
          start(node, n);
        } catch (exp) {
          console.log('error initializing mqtt firmata', exp);
          process.nextTick(() => {
            node.emit('ioError', exp);
          });
        }
      } else if (n.connectionType === 'tcplisten') { // mode listen network
        node.tcpServer = net.createServer((socket) => {
          node.io = new firmata.Board(socket);
          start(node, n);
          console.log('client ready', `${socket.remoteAddress}:${socket.remotePort}`);
          socket.emit('open', {});
          socket.on('error', (err) => {
            console.log('tcp error', err);
            node.warn(err);
            process.nextTick(() => {
              node.emit('networkError', err);
            });
          });
        }).listen(parseInt(n.tcpPort, 10));
      } else if (n.connectionType === 'tcp') {
        // console.log('trying', n.tcpHost, n.tcpPort);
        var options = {
          host: n.tcpHost,
          port: parseInt(n.tcpPort, 10),
        };
        var client = net.connect(options);
        node.io = new firmata.Board(client);
        client.on('connect', () => {
          console.log('client ready');
          client.emit('open', {});
        });
        start(node, n);

        client.on('error', (err) => {
          console.log('tcp error', err);
          node.warn(err);
          process.nextTick(() => {
            node.emit('networkError', err);
          });
        });
      } else if (n.connectionType === 'udp') {
        VirtualSerialPort = require('udp-serial').SerialPort;
        var options = {
          host: n.tcpHost,
          port: parseInt(n.tcpPort, 10),
          type: 'udp4',
        };
        sp = new VirtualSerialPort(options);
        node.io = new firmata.Board(sp, { reportVersionTimeout: 10 });
        process.nextTick(() => {
          node.emit('networkReady', node.io);
        });

        start(node, n);

        sp.on('error', (err) => {
          console.log('udp error', err);
          node.warn(err);
          process.nextTick(() => {
            node.emit('networkError', err);
          });
        });
      }
    } else if (n.boardType === 'raspi-io'
             || n.boardType === 'beaglebone-io'
             || n.boardType === 'galileo-io'
             || n.boardType === 'blend-micro-io'
             || n.boardType === 'ble-io'
             || n.boardType === 'chip-io'
             || n.boardType === 'odroid-io') {
      try {
        node.io = new boardModule();
        start(node, n);
      } catch (exp) {
        console.log('error initializing io class', n.boardType, exp);
        process.nextTick(() => {
          node.emit('ioError', exp);
        });
      }
    } else if (n.boardType === 'bean-io') {
      try {
        var options = {};
        if (n.beanId) {
          options.uuid = n.beanId;
        }
        node.io = new boardModule.Board(options);
        start(node, n);
      } catch (exp) {
        console.log('error initializing bean-io class', n.boardType, exp);
        process.nextTick(() => {
          node.emit('ioError', exp);
        });
      }
    } else if (n.boardType === 'imp-io') {
      try {
        node.io = new boardModule({ agent: n.impId });
        start(node, n);
      } catch (exp) {
        console.log('error initializing imp-io class', n.boardType, exp);
        process.nextTick(() => {
          node.emit('ioError', exp);
        });
      }
    } else if (n.boardType === 'spark-io') {
      try {
        node.io = new boardModule({ deviceId: n.sparkId, token: n.sparkToken });
        start(node, n);
      } catch (exp) {
        console.log('error initializing spark-io class', n.boardType, exp);
        process.nextTick(() => {
          node.emit('ioError', exp);
        });
      }
    }

    if (node.io && node.io.on) {
      node.io.on('error', (err) => {
        node.error(err);
      });
    }
  }
  RED.nodes.registerType('ioplugin', iopluginNode);

  return iopluginNode;
}

module.exports = createNode;
