var createNodebotNode = require('./lib/nodebotNode');

function connectingStatus(n){
  n.status({fill:"red",shape:"ring",text:"connecting"});
}

function networkReadyStatus(n){
  n.status({fill:"yellow",shape:"ring",text:"connecting..."});
}

function networkErrorStatus(n){
  console.log('networkErrorStatus');
  n.status({fill:"red",shape:"dot",text:"disconnected"});
}

function ioErrorStatus(n, err){
  n.status({fill:"red",shape:"dot",text:"error"});
  n.warn(err);
}

function connectedStatus(n){
  n.status({fill:"green",shape:"dot",text:"connected"});
}


function init(RED) {

  createNodebotNode(RED);

  function gpioInNode(n) {
    RED.nodes.createNode(this,n);
    this.buttonState = -1;
    this.pin = n.pin;
    this.state = n.state;
    this.nodebot = RED.nodes.getNode(n.board);
    if (typeof this.nodebot === "object") {
      console.log('gpionode start');

      //this.repeat = this.nodebot.repeat;
      var node = this;
      connectingStatus(node);

      node.nodebot.on('ioready', function() {
        var io = node.nodebot.io;

        connectedStatus(node);
        if (node.state == "ANALOG") {
          var samplingInterval = parseInt(n.samplingInterval, 10) || 300;
          try{io.setSamplingInterval(samplingInterval);}catch(exp){ console.log(exp); }
          try{io.pinMode(node.pin, io.MODES.ANALOG);}catch(exp){ console.log(exp); }
          io.analogRead(node.pin, function(data) {
            var msg = {payload:data, topic:node.pin};
            node.send(msg);
          });
        }
        else {
          try{io.pinMode(node.pin, io.MODES.INPUT);}catch(exp){ console.log(exp); }
            io.digitalRead(node.pin, function(data) {
            var msg = {payload:data, topic:node.pin};
            node.send(msg);
          });
        }
      });
      node.nodebot.on('networkReady', function(){
        networkReadyStatus(node);
      });
      node.nodebot.on('networkError', function(){
        networkErrorStatus(node);
      });
      node.nodebot.on('ioError', function(err){
        ioErrorStatus(node, err);
      });
    }
    else {
      this.warn("nodebot not configured");
    }
  }
  RED.nodes.registerType("gpio in",gpioInNode);

  function gpioOutNode(n) {
    RED.nodes.createNode(this,n);
    this.buttonState = -1;
    this.pin = n.pin;
    this.state = n.state;
    this.arduino = n.arduino;
    this.nodebot = RED.nodes.getNode(n.board);
    this.i2cAddress = parseInt(n.i2cAddress, 10);
    this.i2cRegister = parseInt(n.i2cRegister, 10);
    if (typeof this.nodebot === "object") {
        var node = this;
        connectingStatus(node);

        node.nodebot.on('ioready', function() {
            connectedStatus(node);

            node.on('input', function(msg) {
              try{
                var state = msg.state || node.state;
                var io = node.nodebot.io;
                if (state === 'OUTPUT') {
                  try{io.pinMode(node.pin, node.state);}catch(exp){ console.log(exp); }
                  if ((msg.payload == true)||(msg.payload == 1)||(msg.payload.toString().toLowerCase() === "on")) {
                      io.digitalWrite(node.pin, 1);
                  }
                  if ((msg.payload == false)||(msg.payload == 0)||(msg.payload.toString().toLowerCase() === "off")) {
                      io.digitalWrite(node.pin, 0);
                  }
                }
                else if (state === 'PWM') {
                  try{io.pinMode(node.pin, node.state);}catch(exp){ console.log(exp); }
                  msg.payload = msg.payload * 1;
                  if ((msg.payload >= 0) && (msg.payload <= 255)) {
                      //console.log(msg.payload, node.pin);
                      io.analogWrite(node.pin, msg.payload);
                  }
                }
                else if (state === 'SERVO') {
                  try{io.pinMode(node.pin, node.state);}catch(exp){ console.log(exp); }
                  msg.payload = msg.payload * 1;
                  if ((msg.payload >= 0) && (msg.payload <= 180)) {
                      //console.log(msg.payload, node.pin);
                      io.servoWrite(node.pin, msg.payload);
                  }
                }
                else if(node.state === 'I2C_READ_REQUEST'){
                  var register = parseInt(msg.i2cRegister, 10) || parseInt(node.i2cRegister, 10);
                  var i2cAddress = parseInt(msg.i2cAddress, 10) || parseInt(node.i2cAddress, 10);
                  var numBytes = parseInt(msg.payload, 10);
                  if(io.i2cReadOnce && i2cAddress && numBytes){
                    console.log('i2cReadOnce', i2cAddress, register, numBytes);
                    if(register){
                      io.i2cReadOnce(i2cAddress, register, numBytes, function(data){
                        node.send({
                          payload: data,
                          register: register,
                          i2cAddress: i2cAddress,
                          numBytes: numBytes
                        });
                      });
                    }else{
                      io.i2cReadOnce(i2cAddress, numBytes, function(data){
                        node.send({
                          payload: data,
                          i2cAddress: i2cAddress,
                          numBytes: numBytes
                        });
                      });
                    }
                  }
                }
                else if(node.state === 'I2C_WRITE_REQUEST'){
                  var register = parseInt(msg.i2cRegister, 10) || parseInt(node.i2cRegister, 10);
                  var i2cAddress = parseInt(msg.i2cAddress, 10) || parseInt(node.i2cAddress, 10);
                  if(io.i2cWrite && i2cAddress && msg.payload){
                    console.log('i2cWrite', i2cAddress, register, msg.payload);
                    if(register){
                      io.i2cWrite(i2cAddress, register, msg.payload);
                    }else{
                      io.i2cWrite(i2cAddress, msg.payload);
                    }
                  }
                }
                else if(node.state === 'I2C_DELAY'){
                  if(io.i2cConfig){
                    console.log('i2cConfig', msg.payload);
                    if(register){
                      io.i2cConfig(parseInt(msg.payload, 10));
                    }
                  }
                }
              }
              catch(inputExp){
                node.warn(inputExp);
              }
            });
        });
        node.nodebot.on('networkReady', function(){
          networkReadyStatus(node);
        });
        node.nodebot.on('networkError', function(){
          networkErrorStatus(node);
        });
        node.nodebot.on('ioError', function(err){
          ioErrorStatus(node, err);
        });
    }
    else {
        this.warn("nodebot not configured");
    }

  }

  RED.nodes.registerType("gpio out",gpioOutNode);

  function handleRoute(req, res, handler){
    handler(req.query)
      .then(function(data){
        res.send(data);
      }, function(err){
        console.log('error in gpio request', err);
        res.send(500);
      });
  }

  function listArduinoPorts(callback) {
      return serialport.list(function(err, ports) {
        if (err) {
          return callback(err);
        }
        var devices = [];
        for (var i = 0; i < ports.length; i++) {
          if (/usb|acm|com\d+/i.test(ports[i].comName)) {
            devices.push(ports[i].comName);
          }
        }
        return callback(null, devices);
      });
  }

  //routes
  RED.httpAdmin.get("/gpioserialports", RED.auth.needsPermission("arduino.read"), function(req,res) {
     listArduinoPorts(function (err, ports) {
          res.json(ports);
      });
  });

}

module.exports = init;
