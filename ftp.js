var net = require('net');
var rl = require('readline');
var command = require('./command');

var s = net.createServer(function(so) {
	var ftp_cmds = command;

	so.write('220 (nodejs ftp v0.0)\r\n');
	so.app = { user : '-', pass : '-', cwd : '/', vroot : 'e:/'};
	so.app.config = { data_port : 8889 };

	rl.createInterface({
		input : so,
		output : so
	}).on('line', function(line) {
		var words = line.split(' ');
		var cmd = words[0].toLowerCase();
		var args = words.slice(1).join(' ');
		console.log('[' + cmd + '][' + args + ']');

		if (ftp_cmds[cmd]) {
			ftp_cmds[cmd](so, args);
		} else {
			ftp_cmds.unknown(so, args);
		}
	}).on('close', function() {
		so.end();
	}).on('error', function(e) {
		console.log('error' + e);
	});
}).listen(8888);

