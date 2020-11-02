
// Import the discord.js module
const Discord = require('discord.js');
const discordTTS=require("discord-tts");

const tossups = require("./tossups.json");

// Create an instance of a Discord client
const client = new Discord.Client();

var googleTTS = require('google-tts-api');
var promiseRetry = require('promise-retry');
 

 


/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received from Discord
 */

 var readingTu = 0;
 var buzz = null;
 var botVoiceConnection = null;

 var curPC = null;
 var curC = null;
 var curP = null;
 var curBM = null;
 var curAnswer = "";

 var players = []

var buzzTimedOut=false;

var isPaused = false;
var timeOut = false;
var canBuzz = true;


prefix = "/";
protestTimeout = 7500;
buzzTime = 7000;




async function readTu(connection, powerChunk, chunk, power, botMessage, buzzMessage) {

		if(isPaused) return;
		curPC = powerChunk;
		curC = chunk;
		curP = power;
		curBM = botMessage;

		var msgContent = botMessage.content;

		chunkList = powerChunk[power].split(".");

		if(chunkList[chunk].length > 200) {
			var thisChunk = chunkList[chunk].substring(0,200)
			var nextChunk = chunkList[chunk].substring(200, chunkList[chunk].length -1)
			chunkList[chunk] = thisChunk;
			chunkList.splice(chunk+1, 0, nextChunk);
		}

		currentText = removeParentheses(chunkList[chunk]);
		if(currentText == "") {
			readingTu++; return;
		}
	    
		  	const stream = discordTTS.getVoiceStream(currentText);
		    const dispatcher = connection.play(stream);
		    dispatcher.on("finish",()=>{
		    	botMessage.edit(msgContent + "." + currentText).then(botMessage => {
				    	if(power == 1) {
				    		if(chunk >= chunkList.length-1) {readingTu++; return;}
							readTu(connection, powerChunk, chunk+1, 1, botMessage)
				    	}

				    	if(chunk >= chunkList.length-1 && power == 0) {
				    		readTu(connection, powerChunk, 0, 1, botMessage)
				    	} else if (power == 0) {
				    		readTu(connection, powerChunk, chunk+1, 0, botMessage)
				    	}

		    	})
		    });  

		    await sleep(1000);
		    if(!connection.speaking.bitfield == 1) {

		    	readTu(connection, powerChunk, chunk, power, botMessage, buzzMessage);
		    }

}



const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))
async function readTossups(channel, connection) {
	var i=-1;
	while (true) {
		console.log(i + " / " + readingTu);
		if(i != readingTu) {

			i = readingTu;
			curAnswer = tossups[i]["formatted_answer"].substring(0, tossups[i]["formatted_answer"].lastIndexOf("&lt"))
			channel.send("TU " + (i+1) + ":").then(message => readTu(connection, tossups[i]["text"].split("*"), 0, 0, message));

			
		}
		await sleep(5000);
	}
}

function getUnderlined(text, chunks) {
	var mySubString = text.substring(
    text.lastIndexOf("<strong>") + 8, 
    text.lastIndexOf("</strong>")
	);

	str = text.substring(0, text.lastIndexOf("<strong>"));

	chunks.push(mySubString);
	
	if(str.lastIndexOf("<strong>") == -1) {
		return chunks;
	} else {
		return getUnderlined(str, chunks);
	}
	
}

function removeParentheses(text) {
	if(text.lastIndexOf("(") == -1 || text.lastIndexOf(")") == -1) {
		return text;
	} else {
		start = text.lastIndexOf("(");
	    end = text.lastIndexOf(")")+1;
	    newStr = text.substring(0, start) + text.substring(end, text.length)
	    return removeParentheses(newStr);
	}


}

function judgeAnswer(msg) {

	answers = getUnderlined(curAnswer, [])


	for(i = 0; i < answers.length; i++) {
		if(msg.content.toLowerCase() == answers[i].toLowerCase()) {
			return true;
		}
	}



	return false;
}


client.on('ready', () => {
  console.log('I am ready!');
});



// Create an event listener for messages
client.on('message', async msg => {
  // Voice only works in guilds, if the message does not come from a guild,
  // we ignore it
  if (!msg.guild) return;


  const args = msg.content.slice(prefix.length).trim().split(' ');
  const command = args.shift().toLowerCase();



  if (command === "pause") {
  	if(!isPaused) {
  		botVoiceConnection.play("./pause.mp3");
  		msg.channel.send(":pause_button: Game paused. use **/play** to continue.")
  		isPaused = true;
  	}
  	msg.delete();
  }





  if (command === "skip") {
  	if(!isPaused) {
  		botVoiceConnection.play("./pause.mp3");
  		readingTu = readingTu + 1;
  	}
  	msg.delete();
  }

  if(command === "scorecheck" || command === "sc") {

  	pString = "";

  	for(i = 0; i < players.length; i++) {
  		pString = pString + client.users.cache.get(players[i][0]).username + " : " + players[i][1] + "\n";
  	}


  	  const embed = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle('Scorecheck')
		.setDescription('Tossup ' + (readingTu+1))
		.addField('Player : Score', pString, false)
  	msg.channel.send(embed);
  }

  if (command === "play") {
  	if(isPaused) {
  		isPaused = false;
  		msg.channel.send(":arrow_right: Game will resume in **3** seconds.").then(message => {
  			setTimeout(function(){ 
  				isPaused = false;
  				message.delete();
  				readTu(botVoiceConnection, curPC, curC, curP, curBM);
  			}, 3000);
  		})
  		
  	}
  	msg.delete();
  }

  if (command === "buzz") {

  	var joined=false;
  	if(canBuzz && !isPaused) {
  		
	  	for(i=0;i<players.length;i++) {
	  		if(players[i][0] == msg.author.id) {
	  			joined=true;
	  			msg.reply(" has buzzed! :bulb:").then(message => {
	  				canBuzz = false;
		  			buzz = msg.author;
		  			botVoiceConnection.play("./buzz.mp3");
		  			timeOut = true;
		  			setTimeout(function(){ 
		  				message.delete();
		  				if(timeOut == true) {
							msg.channel.send(":x: Time is up. **-5** points");
							canBuzz = true;
							for(i=0;i<players.length;i++) {
								if(players[i][0] == msg.author.id) {
								  	players[i][1] = players[i][1] - 5;
								}
							}
							buzz = null;
							readTu(botVoiceConnection, curPC, curC, curP, curBM);
		  				}
		  				//msg.delete();
		  			 }, buzzTime);
	  			})
	  		}
	  	}

	  	if(joined == false) {
	  		msg.reply("join with /join first!");
	  	}
  	} 

  	
  }

  if(command === "join") {

  	var joined=false;
  	for(i=0;i<players.length;i++) {
  		if(players[i][0] == msg.author.id) {
  			joined=true;
  		}
  	}

  	if(joined == false) {
	  	players.push([msg.author.id, 0]);
	  	msg.reply("added as a player");
  	}



  }

  if(command === "leave") {
  	for(i=0;i<players.length;i++) {
  		if(players[i][0] == msg.author.id) {
  			players.splice(i, 1);
  			msg.reply("removed as a player");
  		}
  	}
  }

  if(command === "help") {
  	  const embed = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle('Name TBD')
		.setDescription('A Quizbowl moderator bot.')
		.addField('Basic usage', 'Use /read to begin a reading session. The bot will join your current voice chat and begin broadcasting tossups. \n/join - Join a game of QB\n/leave - Leave the game\n/pause - Pause reading\n/play - Continue reading (unpause)\n/buzz - Buzz on the current tossup.', false)
		.addField('Rules', "This bot uses NAQT rules. 15 points power, 10 point tu, and -5 on negs.\nUpon buzzing, you will be recognized and any messages from other players will be deleted. Enter your answer to proceed. You will automatically be negged after __7__ seconds if you do not provide an answer.", false)
		.addField('Protests', "When you give an answer to a tossup, the bot will message you to ensure that your answer should have been accepted or not. Pressing the reaction will overrule the decision of the bot. You can then return to the game room via the url provided.", false)
  	msg.channel.send(embed);
  }


  if (command === "read") {
  	var joined=false;
  	for(i=0;i<players.length;i++) {
  		if(players[i][0] == msg.author.id) {
  			joined=true;
  		}
  	}

  	if(joined == false) {
	  	players.push([msg.author.id, 0]);
	  	msg.reply("added as a player");
  	}
  	readingTu = 0;
    // Only try to join the sender's voice channel if they are in one themselves
    if (msg.member.voice.channel) {

		const voiceChannel = msg.member.voice.channel;
	    voiceChannel.join().then(connection => {
	    	botVoiceConnection = connection;
	    	setTimeout(function(){
    		readTossups(msg.channel, connection);
    		}, 3000);

    	});

	   

    } else {
      msg.reply('You need to join a voice channel first!');
    }
    msg.delete();
  }


  if(msg.author == buzz) {
  	timeOut = false;
  	buzz = null;
  	if(judgeAnswer(msg) == false) {

  		msg.channel.send(":x: Incorrect. **-5** points").then(message => {

  			const exampleEmbed = new Discord.MessageEmbed()
			.setColor('#ff0000')
			.setTitle('Protest Resolver')
			.setDescription('React with :white_check_mark: if your answer should have been marked as correct. Otherwise, if the ruling **__is correct__** then react with :x:.')
			.addField('Answerline: ', curAnswer.split("<strong>").join("__**").split("</strong>").join("**__"), false)
			.addField('Your answer: ', msg.content, false)
			.addField('Press this URL to return to the game room.', message.url, false)

			msg.author.send(exampleEmbed).then(protestDM => {
				var canProtest = true;
				protestDM.react("✅");
				protestDM.react("❌");
				message.edit(":x: Incorrect. **-5** points [Protest resolver: <" + protestDM.url + ">]")

				const filterY = (reaction, user) => {
					return reaction.emoji.name === '✅' && user.id === msg.author.id;
				};

				const filterN = (reaction, user) => {
					return reaction.emoji.name === '❌' && user.id === msg.author.id;
				};

				protestDM.awaitReactions(filterN, { max: 1, time: protestTimeout, errors: ['time'] })
				.then(collected => {
					if(canProtest) {
						canProtest = false;
						message.edit(":x: Incorrect. **-5** points");
							for(i=0;i<players.length;i++) {
								if(players[i][0] == msg.author.id) {
									 players[i][1] = players[i][1] - 5;
								}
							}
						readTu(botVoiceConnection, curPC, curC, curP, curBM);
						canBuzz = true;
						buzz = null;
					}
				})

				protestDM.awaitReactions(filterY, { max: 1, time: protestTimeout, errors: ['time'] })
					.then(collected => {
						if(canProtest) {
							canProtest = false;
							msg.channel.send(":+1: Judgement overriden. Protest accepted.");
							protestDM.channel.send(":+1: Judgement overriden. Protest accepted.");
							message.edit(":white_check_mark: Correct! **+" + (10 + ((1-curP)*5)) + "** points");


				  			const embed = new Discord.MessageEmbed()
							.setColor('#00ff00')
							.setTitle('Tossup ' + (readingTu+1))
							.setDescription(msg.author.username + " got this tossup.")
							.addField('Answerline: ', curAnswer.split("<strong>").join("__**").split("</strong>").join("**__"), false)
							.addField('Answer given: ', msg.content, false)
							msg.channel.send(embed);

							for(i=0;i<players.length;i++) {
								if(players[i][0] == msg.author.id) {
									players[i][1] = players[i][1] + (10 + ((1-curP)*5));
								}
							}
							buzz = null;
							canBuzz = true;
							readingTu++;
						}
					})
					.catch(collected => {
						if(canProtest) {
							canProtest = false;
							message.edit(":x: Incorrect. **-5** points");
							for(i=0;i<players.length;i++) {
								if(players[i][0] == msg.author.id) {
								  	players[i][1] = players[i][1] - 5;
								}
							}
							readTu(botVoiceConnection, curPC, curC, curP, curBM);
							buzz = null;
							canBuzz = true;
						}
					});
			})
  		});


  	} else {
  		console.log(curP);

  		var curMsg = null;

  		msg.channel.send(":white_check_mark: Correct! **+" + (10 + ((1-curP)*5)) + "** points").then(message => {

  			const exampleEmbed = new Discord.MessageEmbed()
			.setColor('#00ff00')
			.setTitle('Protest Resolver')
			.setDescription('React with :x: if your answer should have been marked as incorrect. Otherwise, if the ruling **__is correct__** then react with :white_check_mark:.')
			.addField('Answerline: ', curAnswer.split("<strong>").join("__**").split("</strong>").join("**__"), false)
			.addField('Your answer: ', msg.content, false)
			.addField('Press this URL to return to the game room.', message.url, false)

			msg.author.send(exampleEmbed).then(protestDM => {
				var canProtest = true;
				protestDM.react("❌");
				protestDM.react("✅");
				message.edit(":white_check_mark: Correct! **+" + (10 + ((1-curP)*5)) + "** points [Protest resolver: <" + protestDM.url + ">]")
				const filterY = (reaction, user) => {
					return reaction.emoji.name === '✅' && user.id === msg.author.id;
				};

				const filterN = (reaction, user) => {
					return reaction.emoji.name === '❌' && user.id === msg.author.id;
				};

				protestDM.awaitReactions(filterY, { max: 1, time: protestTimeout, errors: ['time'] })
				.then(collected => {
					if(canProtest) {
						canProtest = false;
							message.edit(":white_check_mark: Correct! **+" + (10 + ((1-curP)*5)) + "** points");
				  			const embed = new Discord.MessageEmbed()
							.setColor('#00ff00')
							.setTitle('Tossup ' + (readingTu+1))
							.setDescription(msg.author.username + " got this tossup.")
							.addField('Answerline: ', curAnswer.split("<strong>").join("__**").split("</strong>").join("**__"), false)
							.addField('Answer given: ', msg.content, false)
							msg.channel.send(embed);


							for(i=0;i<players.length;i++) {
								if(players[i][0] == msg.author.id) {
									players[i][1] = players[i][1] + (10 + ((1-curP)*5));
								}
							}
							readingTu++;
							canBuzz = true;
							buzz = null;
					}
				})

				protestDM.awaitReactions(filterN, { max: 1, time: protestTimeout, errors: ['time'] })
					.then(collected => {
						if(canProtest) {
							canProtest = false;
							
							msg.channel.send(":+1: Judgement overriden. Continuing tossup.");
							protestDM.channel.send(":+1: Judgement overriden. Continuing tossup.");
							message.edit(":x: Incorrect. **-5** points");

							for(i=0;i<players.length;i++) {
								if(players[i][0] == msg.author.id) {
								  	players[i][1] = players[i][1] - 5;
								}
							}
							canBuzz = true;
							readTu(botVoiceConnection, curPC, curC, curP, curBM);
						}
					})
					.catch(collected => {
						if(canProtest) {
							canProtest = false;
							message.edit(":white_check_mark: Correct! **+" + (10 + ((1-curP)*5)) + "** points");
				  			const embed = new Discord.MessageEmbed()
							.setColor('#00ff00')
							.setTitle('Tossup ' + (readingTu+1))
							.setDescription(msg.author.username + " got this tossup.")
							.addField('Answerline: ', curAnswer.split("<strong>").join("__**").split("</strong>").join("**__"), false)
							.addField('Answer given: ', msg.content, false)
							msg.channel.send(embed);


							for(i=0;i<players.length;i++) {
								if(players[i][0] == msg.author.id) {
									players[i][1] = players[i][1] + (10 + ((1-curP)*5));
								}
							}
							readingTu++;
							canBuzz = true;
							buzz = null;
						}
					});
			})
  		});
  	}
  } else {
  	if(buzz != null || isPaused == false) {
  	for(i=0;i<players.length;i++) {
  		if(players[i][0] == msg.author.id) {
  			msg.delete();
  		}
  	}
  	}
  }

});

// Log our bot in using the token from https://discord.com/developers/applications
client.login('Mjk0ODg5ODc1OTQ0MTEyMTI4.WNVbmQ.W8kLE207tu_qBO4RqERE1ChgZZw');