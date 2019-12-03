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

const serialport = require('serialport');
const createIOPluginNode = require('./lib/iopluginNode');

const five = require('johnny-five');
const vm = require('vm');
const util = require('util');
const NodeLed = require('node-led');
const _ = require('lodash');

function connectingStatus(n) {
  n.status({ fill: 'red', shape: 'ring', text: 'connecting ... ' });
}

function networkReadyStatus(n) {
  n.status({ fill: 'yellow', shape: 'ring', text: 'connecting...' });
}

function networkErrorStatus(n) {
  n.status({ fill: 'red', shape: 'dot', text: 'disconnected' });
}

function ioErrorStatus(n, err) {
  n.status({ fill: 'red', shape: 'dot', text: 'error' });
  n.warn(err);
}

function connectedStatus(n) {
  n.status({ fill: 'green', shape: 'dot', text: 'connected !!!! ' });
}


function init(RED) {
  createIOPluginNode(RED);

  function gpioInNode(n) {
    RED.nodes.createNode(this, n);
    this.buttonState = -1;
    this.pin = n.pin;
    this.state = n.state;
    this.ioplugin = RED.nodes.getNode(n.board);
    if (typeof this.ioplugin === 'object') {
      const node = this;
      connectingStatus(node);

      node.ioplugin.on('ioready', () => {
        const { io } = node.ioplugin;

        connectedStatus(node);
        if (node.state == 'ANALOG') {
          const samplingInterval = parseInt(n.samplingInterval, 10) || 300;
          try { io.setSamplingInterval(samplingInterval); } catch (exp) { console.log(exp); }
          try { io.pinMode(node.pin, io.MODES.ANALOG); } catch (exp) { console.log(exp); }
          io.analogRead(node.pin, (data) => {
            const msg = { payload: data, topic: node.pin };
            node.send(msg);
          });
        } else if (node.state == 'PULLUP') {
          try { io.pinMode(node.pin, io.MODES.PULLUP); } catch (exp) { console.log(exp); }
          io.digitalRead(node.pin, (data) => {
            const msg = { payload: data, topic: node.pin };
            node.send(msg);
          });
        } else {
          try { io.pinMode(node.pin, io.MODES.INPUT); } catch (exp) { console.log(exp); }
          io.digitalRead(node.pin, (data) => {
            const msg = { payload: data, topic: node.pin };
            node.send(msg);
          });
        }
      });
      node.ioplugin.on('networkReady', () => {
        networkReadyStatus(node);
      });
      node.ioplugin.on('networkError', () => {
        networkErrorStatus(node);
      });
      node.ioplugin.on('ioError', (err) => {
        ioErrorStatus(node, err);
      });
    } else {
      this.warn('ioplugin not configured');
    }
  }
  RED.nodes.registerType('gpio in', gpioInNode);

  function gpioOutNode(n) {
    RED.nodes.createNode(this, n);
    this.buttonState = -1;
    this.pin = n.pin;
    this.state = n.state;
    this.arduino = n.arduino;
    this.ioplugin = RED.nodes.getNode(n.board);
    this.i2cAddress = parseInt(n.i2cAddress, 10);
    this.i2cRegister = parseInt(n.i2cRegister, 10);
    if (typeof this.ioplugin === 'object') {
      const node = this;
      connectingStatus(node);

      node.ioplugin.on('ioready', () => {
        connectedStatus(node);

        node.on('input', (msg) => {
          try {
            const state = msg.state || node.state;
            const { io } = node.ioplugin;
            if (state === 'OUTPUT') {
              try { io.pinMode(node.pin, io.MODES[state]); } catch (exp) { console.log(exp); }
              if ((msg.payload == true) || (msg.payload == 1) || (msg.payload.toString().toLowerCase() === 'on')) {
                io.digitalWrite(node.pin, 1);
              }
              if ((msg.payload == false) || (msg.payload == 0) || (msg.payload.toString().toLowerCase() === 'off')) {
                io.digitalWrite(node.pin, 0);
              }
            } else if (state === 'PWM') {
              try { io.pinMode(node.pin, io.MODES[state]); } catch (exp) { console.log(exp); }
              msg.payload *= 1;
              if ((msg.payload >= 0) && (msg.payload <= 255)) {
                // console.log(msg.payload, node.pin);
                io.analogWrite(node.pin, msg.payload);
              }
            } else if (state === 'SERVO') {
              try { io.pinMode(node.pin, io.MODES[state]); } catch (exp) { console.log(exp); }
              msg.payload *= 1;
              if ((msg.payload >= 0) && (msg.payload <= 180)) {
                // console.log(msg.payload, node.pin);
                io.servoWrite(node.pin, msg.payload);
              }
            } else if (node.state === 'I2C_READ_REQUEST') {
              var register = parseInt(msg.i2cRegister, 10) || parseInt(node.i2cRegister, 10);
              var i2cAddress = parseInt(msg.i2cAddress, 10) || parseInt(node.i2cAddress, 10);
              const numBytes = parseInt(msg.payload, 10);
              if (io.i2cReadOnce && i2cAddress && numBytes) {
                if (register) {
                  io.i2cReadOnce(i2cAddress, register, numBytes, (data) => {
                    node.send({
                      payload: data,
                      register,
                      i2cAddress,
                      numBytes,
                    });
                  });
                } else {
                  io.i2cReadOnce(i2cAddress, numBytes, (data) => {
                    node.send({
                      payload: data,
                      i2cAddress,
                      numBytes,
                    });
                  });
                }
              }
            } else if (node.state === 'I2C_WRITE_REQUEST') {
              var register = parseInt(msg.i2cRegister, 10) || parseInt(node.i2cRegister, 10);
              var i2cAddress = parseInt(msg.i2cAddress, 10) || parseInt(node.i2cAddress, 10);
              if (io.i2cWrite && i2cAddress && msg.payload) {
                if (register) {
                  io.i2cWrite(i2cAddress, register, msg.payload);
                } else {
                  io.i2cWrite(i2cAddress, msg.payload);
                }
              }
            } else if (node.state === 'I2C_DELAY') {
              if (io.i2cConfig) {
                if (register) {
                  io.i2cConfig(parseInt(msg.payload, 10));
                }
              }
            }
          } catch (inputExp) {
            node.warn(inputExp);
          }
        });
      });
      node.ioplugin.on('networkReady', () => {
        networkReadyStatus(node);
      });
      node.ioplugin.on('networkError', () => {
        networkErrorStatus(node);
      });
      node.ioplugin.on('ioError', (err) => {
        ioErrorStatus(node, err);
      });
    } else {
      this.warn('ioplugin not configured');
    }
  }

  RED.nodes.registerType('gpio out', gpioOutNode);


  function nodeLedNode(n) {
    RED.nodes.createNode(this, n);
    this.buttonState = -1;
    this.address = Number(n.address);
    this.mode = n.mode;
    this.arduino = n.arduino;
    this.ioplugin = RED.nodes.getNode(n.board);
    if (typeof this.ioplugin === 'object') {
      const node = this;
      connectingStatus(node);

      node.ioplugin.on('ioready', () => {
        node.comp = new NodeLed[node.mode](node.ioplugin.io, { address: node.address });
        connectedStatus(node);

        node.on('input', (msg) => {
          try {
            if (node.mode === 'AlphaNum4' || node.mode === 'SevenSegment') {
              node.comp.writeText(msg.payload);
            } else {
              node.comp.drawBitmap(msg.payload);
            }
          } catch (inputExp) {
            node.warn(inputExp);
          }
        });
      });
      node.ioplugin.on('networkReady', () => {
        networkReadyStatus(node);
      });
      node.ioplugin.on('networkError', () => {
        networkErrorStatus(node);
      });
      node.ioplugin.on('ioError', (err) => {
        ioErrorStatus(node, err);
      });
    } else {
      this.warn('ioplugin not configured');
    }
  }

  RED.nodes.registerType('node-led', nodeLedNode);


  function handleRoute(req, res, handler) {
    handler(req.query)
      .then((data) => {
        res.send(data);
      }, (err) => {
        console.log('error in gpio request', err);
        res.send(500);
      });
  }

  function listArduinoPorts(callback) {
    return serialport.list().then(ports => {
      const devices = [];
      for (let i = 0; i < ports.length; i++) {
        if (/usb|acm|com\d+/i.test(ports[i].path)) {
          devices.push(ports[i].path);
        }
      }
      return callback(null, devices);
    });
  }


  function scriptNode(n) {
    RED.nodes.createNode(this, n);

    // console.log('initializing scriptNode', n);
    this.ioplugin = RED.nodes.getNode(n.board);
    this.func = n.func;
    const node = this;


    if (typeof this.ioplugin === 'object') {
      process.nextTick(() => {
        connectingStatus(node);
      });

      // console.log('launching scriptNode', n);
      node.ioplugin.on('ioready', function () {
        // console.log('launching scriptNode ioready', n);
        connectedStatus(node);

        function sendResults(node, msgs) {
          const _msgid = (1 + Math.random() * 4294967295).toString(16);
          if (msgs == null) {
            return;
          } if (!util.isArray(msgs)) {
            msgs = [msgs];
          }
          let msgCount = 0;
          for (let m = 0; m < msgs.length; m++) {
            if (msgs[m]) {
              if (util.isArray(msgs[m])) {
                for (let n = 0; n < msgs[m].length; n++) {
                  msgs[m][n]._msgid = _msgid;
                  msgCount++;
                }
              } else {
                msgs[m]._msgid = _msgid;
                msgCount++;
              }
            }
          }
          if (msgCount > 0) {
            node.send(msgs);
          }
        }

        const functionText = `${'var results = null;'
                   + 'results = (function(){ '
                      + 'var node = {'
                         + 'log:__node__.log,'
                         + 'error:__node__.error,'
                         + 'warn:__node__.warn,'
                         + 'on:__node__.on,'
                         + 'status:__node__.status,'
                         + 'send:function(msgs){ __node__.send(msgs);}'
                      + '};\n'}${
          node.func}\n`
                   + '})();';

        const sandbox = {
          console,
          util,
          Buffer,
          __node__: {
            log() {
              node.log.apply(node, arguments);
            },
            error() {
              node.error.apply(node, arguments);
            },
            warn() {
              node.warn.apply(node, arguments);
            },
            send(msgs) {
              sendResults(node, msgs);
            },
            on() {
              node.on.apply(node, arguments);
            },
            status() {
              node.status.apply(node, arguments);
            },
          },
          context: {
            set() {
              return node.context().set.apply(node, arguments);
            },
            get() {
              return node.context().get.apply(node, arguments);
            },
            get global() {
              return node.context().global;
            },
            get flow() {
              return node.context().flow;
            },
          },
          flow: {
            set() {
              node.context().flow.set.apply(node, arguments);
            },
            get() {
              return node.context().flow.get.apply(node, arguments);
            },
          },
          global: {
            set() {
              node.context().global.set.apply(node, arguments);
            },
            get() {
              return node.context().global.get.apply(node, arguments);
            },
          },
          setTimeout,
          clearTimeout,
          _,
          five,
          board: node.ioplugin.board,
          boardModule: node.ioplugin.boardModule,
          RED,
          require,

        };
        const context = vm.createContext(sandbox);


        try {
          node.script = vm.createScript(functionText);
          try {
            const start = Date.now(); // process.hrtime();
            // context.msg = msg;
            node.script.runInContext(context);
            // console.log('ran script', context);
          } catch (err) {
            let line = 0;
            let errorMessage;
            const stack = err.stack.split(/\r?\n/);
            if (stack.length > 0) {
              while (line < stack.length && stack[line].indexOf('ReferenceError') !== 0) {
                line++;
              }

              if (line < stack.length) {
                errorMessage = stack[line];
                const m = /:(\d+):(\d+)$/.exec(stack[line + 1]);
                if (m) {
                  const lineno = Number(m[1]) - 1;
                  const cha = m[2];
                  errorMessage += ` (line ${lineno}, col ${cha})`;
                }
              }
            }
            if (!errorMessage) {
              errorMessage = err.toString();
            }
            this.error(errorMessage);
          }
        } catch (err) {
          // eg SyntaxError - which v8 doesn't include line number information
          // so we can't do better than this
          this.error(err);
        }
      });
      node.ioplugin.on('networkReady', () => {
        networkReadyStatus(node);
      });
      node.ioplugin.on('networkError', () => {
        networkErrorStatus(node);
      });
      node.ioplugin.on('ioError', (err) => {
        ioErrorStatus(node, err);
      });
    } else {
      this.warn('ioplugin not configured');
    }
  }

  RED.nodes.registerType('script', scriptNode);


  // routes
  RED.httpAdmin.get('/johnny5serialports', RED.auth.needsPermission('arduino.read'), (req, res) => {
    listArduinoPorts((err, ports) => {
      res.json(ports);
    });
  });
}

module.exports = init;
