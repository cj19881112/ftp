var net = require('net');
var fs = require('fs');
var rl = require('readline');
var path = require('path');

var s = net.createServer(function(so) {
	var ftp_cmds = {
		'user' : function(so, args) {
			so.app.user = args;
			so.write('331 Please specify the password.\r\n');
		},
		'pass' : function(so, args) {
			so.app.pass = args;
			so.write('230 Login successful.\r\n');
		},
		'syst' : function(so, args) {
			so.write('215 Unix cj\r\n');
		},
		'feat' : function(so, args) {
			so.write('211-Feature:\n211 End\r\n');
		},
		'clnt' : function(so, args) {
			so.app.cli = args;
			so.write('200 OK i know.\r\n');
		},
		'pwd' : function(so, args) {
			so.write('257 "' + so.app.cwd + '"\r\n');
		},
		'rest' : function(so, args) {
			so.app.rest = args;
			so.write('350 Restart position accepted (' + args + ').\r\n');
		},
		'type' : function(so, args) {
			mode = 'binary';
			if ('A' === args) {
				ret = 'ASCII';
			}
			so.write('200 Switch to ' + mode + ' OK\r\n');
		},
		'cwd' : function(so, dir) {
			if (dir[0] === '/') {
				so.app.cwd = dir;
			} else {
				so.app.cwd = path.join(so.app.cwd, dir);
			}
			so.write('250 Directry successfully changed.\r\n');
		},
		'pasv' : function(so, args) {
			if (!so.app.dil) {
				so.app.dil = net.createServer(function(conn) {
					so.app.di = conn;
				}).on('error', function(e) {
					console.log(e);
				}).listen(so.app.config.data_port);
			}
			port = parseInt(so.app.config.data_port);
			hl = (port >> 8) & 0xFF;
			lo = (port & 0xFF);
			addr = '127,0,0,1,' + hl +','+ lo;
			so.write('227 Entering Passive Mode ('+addr+')\r\n');
		},
		'list' : function(so, args) {
			if (!so.app.di) {
				console.log('error');
			} else {
				so.write('150 Here comes the directory listing.\r\n');
				// list directory
				var fileList = function(dir) {
					console.log('listing directory :' + dir);
					var line = '';
					fs.readdirSync(dir).forEach(function(f) {
						try {
							var stat = fs.lstatSync(path.join(dir,f));
						} catch (e) {
							console.log('list:' + e);
							return ;
						}
						// file type
						if (stat.isFile()) {
							line += '-';
						} else if (stat.isDirectory()) {
							line += 'd';
						} else if (stat.isBlockDevice()) {
							line += 'b';
						} else if (stat.isCharacterDevice()) {
							line += 'c';
						} else if (stat.isSymbolicLink()) {
							line += 'l';
						} else if (stat.isFIFO()) {
							line += 'f';
						} else if (stat.isSocket()) {
							line += 's';
						}
						// file mode
						var mask = {
							00 : '---',
							02 : '-w-',
							01 : '--x',
							03 : '-wx',
							06 : 'rw-',
							05 : 'r-x',
							07 : 'rwx',
						};
						line += mask[stat.mode>>16 & 0xF];
						line += mask[stat.mode>> 8 & 0xF];
						line += mask[stat.mode & 0xF];
						line += ' ';
						// node link
						line += stat.nlink + ' '; 
						// user, group
						line += stat.uid + ' ' + stat.gid + ' ';
						// size
						line += stat.size + ' ';
						// date 
						line += [
							'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
							'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
						][stat.mtime.month] + ' ' + stat.mtime.day + ' ';
						// time
						line += stat.mtime.hour + ':' + stat.mtime.minute + ' ';
						// filename
						line += f + '\n';
					});
					return line;
				}(path.join(so.app.vroot,so.app.cwd), '');
				// end list directory
				so.app.di.write(fileList, function(err) {
					if (!err) {
						so.app.di.end();
						so.write('226 Directory send OK.\r\n');
					} else {
						// ??
					}
				});
			}
		},
		'retr' : function(so, filename) {
			try {
				var size = fs.lstatSync(path.join(so.app.vroot,filename)).size;
				so.write('150 Opening BINARY mode data connection for ' + 
					path.join(so.app.vroot,filename)+'('+size+' bytes)\r\n');
			} catch (e) {
				console.log(e);
			}

			var fin = fs.createReadStream(path.join(so.app.vroot,filename));
			so.on('drain', function() {
				fin.resume();
			});
			fin.on('data', function(data) {
				if (!so.app.di.write(data)) {
					fin.pause();
				}
			}).on('end', function() {
				so.write('226 Transfer complete.\r\n');
				so.app.di.end();
				so.app.di = null;
			});
		},
		'stor' : function(so, args) {
			so.write('150 OK to send data.\r\n');
			var fout = fs.createWriteStream(path.join(so.app.vroot,args));
			fout.on('drain', function() {
				if (so.app.di)
					so.app.di.resume();
			});
			so.app.di.on('data', function(data) {
				if (!fout.write(data)) {
					so.app.di.pause();
				}
			}).on('end', function() {
				so.app.di.end();
				so.app.di = null;
				so.write('226 Transfer complete.\r\n');
			}).on('error', function(e) {
				console.log(e);
			});
		},
		'dele' : function(so, args) {
			//so.write();
			fs.unlink(path.join(so.app.vroot, args), function(err) {
				if (!err) {
					so.write('250 Delete operation successful.\r\n');
				}
			});
		},
		'mkd' : function(so, args) {
			fs.mkdir(path.join(so.app.vroot, args), function(err) {
				if (!err) {
					so.write('257 ' + args + ' created.\r\n');
				}
			});
		},
		'noop' : function(so, args) {
			so.write('200 Noop OK\r\n');
		},
		'unknown' : function(so, args) {
			so.write('500 Unknown command\r\n');
		}
	};

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

