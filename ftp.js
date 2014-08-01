var net = require('net');
var fs = require('fs');
var rl = require('readline');
var path = require('path');
var command = require('./command');

var s = net.createServer(function(so) {
	var ftp_cmds = command;

	so.write('220 (nodejs ftp v0.0)\r\n');
	so.app = { user : '-', pass : '-', cwd : '/', vroot : 'e:/src'};
	so.app.config = { data_port : 8889 };

	var cli = rl.createInterface({
		input : so,
		output : so
	}).on('line', function(line) {
		words = line.split(' ');
		cmd = words[0].toLowerCase();
		args = words.slice(1).join(' ');
		console.log('[' + cmd + '][' + args + ']');

		if (ftp_cmds[cmd]) {
			ftp_cmds[cmd](so, args)
		} else {
			ftp_cmds['unknown'](so, args);
		}
	}).on('close', function() {
		so.end();
	}).on('error', function(e) {
		console.log('error' + e);
	});
}).listen(8888);

