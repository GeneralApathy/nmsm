#! /usr/bin/env node

/*

	Simple, Node.js based, Minecraft server manager
	Written just for fun, will probably update it.
	Tested on Linux, I'm not sure it will work on Windows.

	Server directory will be customizable in the future, for now it just uses an internal directory
	'minecraft-manager' command must be executed in the script directory

	STILL IN DEVELOPMENT

*/

const Promise = require("promise");
const child_process = require("child_process");
const colors = require("colors");
const fs = require("fs");
const https = require('https');

var processes = [];
var servers = [];
var mc;
var consolemode = false;
var current;
var currentServer;

console.log("Welcome to Node Minecraft Server Manager".yellow);
console.log("Type 'create <server-name>' to create a new server".cyan);

var mkdir = (directory) => {

	return new Promise(

		(resolve, reject) => {

			var pattern = new RegExp(/[A-Z][0-9][a-z]/);

			if(!pattern.test)
				return console.log("Directory name should only contain alphanumeric characters")

			fs.mkdir(__dirname + '/servers/' + directory ,function(err){
   			if (err)
					return reject(err);

   			resolve(true);

			});

		}

	)

}

var init = (path, port) => {

	return new Promise(

		(resolve, reject) => {

			fs.writeFile(path + "/logfile.log", "LOGFILE\n", function(err) {
				if(err)
						return reject(err);

						fs.writeFile(path + "/eula.txt", "eula=true", function(err) {
							if(err)
									return reject(err);

									fs.writeFile(path + "/server.properties", "server-port="+port, function(err) {
										if(err)
												return reject(err);

										return resolve({

											success: true,
											path: path

										});

									});
						});

			});

		}

	)

}

var stdin = process.openStdin();
stdin.addListener("data", (data) => {

	var split = data.toString('utf8').replace(/\n/g, '').split(' ');

	if(consolemode){

		console.log("To exit console mode type 'quit'");

		switch(split[0]){

			/*case "stop":

				current.stdout.write("stop")

				fs.readFile("./servers/"+currentServer+"/logfile.log", "UTF-8", function(err, data) {
						if (err) throw err;
						process.stdout.write(data);

						fs.watch("./servers/"+currentServer+"/logfile.log", function(event, filename) {
							if (event == "change") {

								fs.readFile("./servers/"+currentServer+"/logfile.log", function(err, data) {

									process.stdout.write(data);
									consolemode = false;
									console.log("Detached from console mode".yellow)

							});

							}

					});

				});

			break;

			TO FIX

			*/

			case "quit":
			case "exit":
			case "q":

			consolemode = false;
			console.log('\x1Bc');
			console.log("Exited console mode".yellow)

			break;

			default:

			current.stdin.write(data.toString('utf8'));

			break;

		}

	}else{

		switch (split[0]) {

			case "help":
			case "h":

				console.log(" == COMMAND LIST == ".cyan);
				console.log("- create <servername> <port> -> creates a new server\n\tservername: name of the server (mandatory)\n\tport: port on which the server will be listening (mandatory)\n\texample: create my-server 25565")
				console.log("- start <servername> [allocated_ram] -> starts an existent server\n\tservername: name of the server (mandatory)\n\tallocated_ram: RAM (in MB) allocated to the server [-Xmx jvm option] (optional)\n\texample: start my-server 2048")
				console.log("- plugin <source> <server> <name> -> fetches a plugin from the specified source\n\tsource: URL that refers to a plugin (mandatory)\n\tserver: name of the server in which the plugin will be downloaded (mandatory)\n\tplugin: string that will be the name of the downloaded plugin (mandatory)")
				console.log("- list -> lists all the active servers");
				console.log("- get -> gets every server available (even if not started)")
				console.log("- quit -> quits the application and shuts down all the servers attached to it");

			break;

			case "plugin":
			case "pl":

			var plugin = [];
			var chunks = 0;

			console.log(split)

			var req = https.get(split[1], function(response){

				var length = parseInt(response.headers['content-length'], 10);

				response.on('data', (chunk) => {

					plugin.push(chunk);
					chunks += chunk.byteLength;
					process.stdout.write("Downloading plugin " +  chunks + "/" + length + "\r");

				})

				response.on('end', () => {

					plugin = Buffer.concat(plugin);
					fs.writeFile('./servers/' + split[2] +  '/plugins/' + split[3], plugin, function(err, data){

						if(err) console.log(err);

						console.log("\n");
						console.log("Finished downloading! (%d bytes long)".cyan, chunks);
						console.log("You may run 'restart %s' to enable the plugin", split[2])

						//todo: restart command

					})

				})

			});

			break;

			case "get":

			console.log("Available servers".cyan);

			fs.readdir("./servers", (err, files) => {

				files.forEach(file => {

					fs.lstat("./servers/" + file, (err, stats) => {

    				if(err)
        			return console.log(err);
    					if(stats.isDirectory())
								console.log(file)

				});

			})

		})

			break;

			case "console":

			consolemode = true;

				if(!split[1])
					return console.log("Too few parameters: console <servername>".red);

				for(var i = 0; i < servers.length; i++){

					if(servers[i] == split[1])
						current = processes[i]; currentServer = servers[i];

				}
				console.log('\x1Bc');
				console.log("Now in console mode".yellow);

				fs.readFile("./servers/"+split[1]+"/logfile.log", "UTF-8", function(err, data) {
						if (err) throw err;
						process.stdout.write(data);

						fs.watch("./servers/"+split[1]+"/logfile.log", function(event, filename) {
							if (event == "change") {

								fs.readFile("./servers/"+split[1]+"/logfile.log", function(err, data) {

									process.stdout.write(data);

							});

							}

					});

				});

			break;

			case "list":

			console.log("List of active servers".cyan);
			for(var i = 0; i < servers.length; i++)
				console.log("%s - PID: %d", servers[i], processes[i].pid)

			break;

			case "create":

			if(!split[2])
				return console.log("Too few arguments: create <servername> <port>");

				if(split[1]){

					mkdir(split[1]).then(success => {

						return init('./servers/' + split[1], split[2]);

				}).catch(err => {

					console.log(err);

				}).then(success => {

					console.log(success.path + "/logfile.log has been created");

					var spigot = [];
					var chunks = 0;

					var req = https.get('https://cdn.emilianomaccaferri.com/node/spigot.jar', function(response){

						var length = parseInt(response.headers['content-length'], 10);
						console.log(response.headers['Content-Disposition'])

						response.on('data', (chunk) => {

							spigot.push(chunk);
							chunks += chunk.byteLength;
							process.stdout.write("Downloading " +  chunks + "/" + length + "\r");

						})

						response.on('end', () => {

							spigot = Buffer.concat(spigot);
							fs.writeFile('./servers/' + split[1] +  '/spigot.jar', spigot, function(err, data){

								if(err) console.log(err);

								console.log("\n");
								console.log("Finished downloading spigot.jar! (%d bytes long)".cyan, chunks);
								console.log("You may run 'start %s to start the server'", split[1])

							})

						})

					});

				})

			}else
				return console.log("Too few arguments: create <servername> <port>");

			break;

			case "clear":
			case "cls":

			console.log('\x1Bc');

			break;

			case "start":

			var allocated = 0;

				if(!split[1])
					return console.log("Too few arguments: start <servername> [allocated ram]");

				if(!split[2])
					allocated = 512;

				var mc = child_process.spawn('java', [

					'-Xmx'+allocated+'M',
					'-Xms256M',
					'-jar',
					'spigot.jar'

				], {cwd: "servers/" + split[1]})

			processes.push(mc);
			servers.push(split[1]);

			mc.stdout.on('data', (data) => {

				var server = split[1];

				fs.appendFile('./servers/'+server+"/logfile.log", data, 'utf8', function (err) {

						if (err) console.log(err)

				});

			});

			mc.stderr.on('data', (data) => {

				var server = split[1];

				fs.appendFile('./servers/'+server+"/logfile.log", data, 'utf8', function (err) {

						if (err) console.log(err)

				});

			});

			mc.on('close', (code, signal) => {

				console.log("Closing due to %s", signal)

			})
			processes.push(mc);

			break;

			case "quit":
			case "exit":
			case "q":

				for(var i = 0; i < processes.length; i++)
					processes[i].kill("SIGHUP");

				process.exit();

			break;

			default:

				console.log("Command not found. Type 'help' to get a list of commands".red);

			break;

		}

	}

})

process.on('SIGINT', function() {
    console.log("Caught interrupt signal");
		for(var i = 0; i < processes.length; i++)
			processes[i].kill("SIGHUP");

		process.exit();
});
