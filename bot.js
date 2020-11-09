
// Import the discord.js module
const Discord = require('discord.js');
const discordTTS=require("discord-tts");

var tossups = null;
var difficultyList = [];

// Create an instance of a Discord client
const client = new Discord.Client();
const category_mapping = require("./category_mapping.json");
var tournament_mapping = [];

const { Pool, Client } = require('pg')
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'betterqb',
  password: 'postgres',
  port: 5432,
})

var fs = require('fs');

const fsPromises = fs.promises;




 

 


/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received from Discord
 */

// LOCAL VARS -- will be put into txt or json files so concurrent play exists.


//GLOBAL VARS
var prefix = "/";
var gameData = {}
var playersCurrentlyInGame = 0;
var version = "ALPHA v0.4.1";
var uptimeSeconds = 0;
var restartAcknowledgeMessage = "";

async function saveAndExit() {
  try {

    await fsPromises.writeFile("popbotGameData.json", JSON.stringify(gameData));
    process.exit();
  } catch (err) {
    console.error('Error occured while reading directory!', err);
    process.exit();
  }
}

async function save() {
  try {
    await fsPromises.writeFile("popbotGameData.json", JSON.stringify(gameData));
  } catch (err) {
    console.error('Error occured while reading directory!', err);
  }
}

function load() {
  gameData = require("./popbotGameData.json");
}

function createEmptyServerData() {
	var json = 
		{
			"readingTu":0, 
			"buzz":null,
			"curPC":null,
			"curC":null,
			"curP":null,
			"curBM":null,
			"curAnswer":"",
			"canPowerThisTossup":0,
			"players":[],
			"plrTimeout":[],
			"isPaused":false,
			"timeOut":false,
			"canBuzz":true,
			"tuTimeout":3000,
			"currentTuTimeout":0,
			"currentTuCanTimeout":false,
			"canTalk":false,
			"allowBuzzMultipleTimes":false,
			"allowTalkingDuringGame":true,
			"enableCelebration":true,
			"category_list":[],
			"gameBeingPlayed":false,
			"botVoiceConnection":null,
			"readingTextChannel":null,
			"buzzTime":9000,
			"protestTimeout":5000
		}
	return json;
}

function getVar(message_for, var_name) {
	var id = message_for.guild.id;
	return gameData[id][var_name]
}

function setVar(message_for, var_name, value) {
	var id = message_for.guild.id;
	gameData[id][var_name] = value;
	return true;
}

function varSetExists(message_for) {
	
	return gameData[message_for.guild.id] != null;
}


async function awaitNextTossup(msg) {
	setVar(msg, "currentTuCanTimeout", true)
	setVar(msg, "currentTuTimeout", 0)
	while ("currentTuTimeout" < getVar(msg, "tuTimeout")) {
		await sleep(100);
		setVar(msg, "currentTuTimeout", getVar("currentTuTimeout"));

		if(getVar(msg, "isPaused")) {
			setVar(msg, "currentTuTimeout", 0)
		}

		if(buzz != null) {
			setVar(msg, "currentTuTimeout", -1 * getVar(msg, "protestTimeout"));
		}


	}

	if(getVar(msg, "currentTuCanTimeout") == true) {

		const embed = new Discord.MessageEmbed()
		.setColor('#ff0000')
		.setTitle('Tossup ' + (getVar(msg, "readingTu")+1))
		.setDescription("nobody got this tossup.")
		.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
		.setFooter(getTournamentName(tossups[getVar(msg, "readingTu")].tournament_id) + " // rd: " + tossups[getVar(msg, "readingTu")].round)
		getVar(msg, "curBM").channel.send(embed);

		getVar(msg, "curBM").edit(tossups[readingTu]["text"]);

		setVar(msg, "readingTu", getVar(msg, "readingTu")+1);
		setVar(msg, "currentTuCanTimeout", false)
	}
}

function loadTournamentMapping() {

	pool.query("SELECT * FROM tournaments", (err, res) => {
									
		tournament_mapping = res.rows;

	})

}

function celebrate(message, userID, score) {
		const embed = new Discord.MessageEmbed()
		.setColor('#ffd700')
		.setTitle("**" + message.guild.members.cache.get(userID).nickname + "** has reached __**" + score + "**__ points!")

	message.channel.send(embed)
}

async function readTu(msg, connection, powerChunk, chunk, power, botMessage, buzzMessage, canPowerThisTossup) {

		if(getVar(msg, "isPaused")) return;
		setVar(msg, "canTalk", false)
		setVar(msg, "curPC", powerChunk);
		setVar(msg, "curC", chunk);
		setVar(msg, "curP", power);
		setVar(msg, "curBM", botMessage);

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
			awaitNextTossup(msg);
			return;
		}
	    
		  	const stream = discordTTS.getVoiceStream(currentText);
		    const dispatcher = connection.play(stream);
		    dispatcher.on("finish",()=>{
		    	botMessage.edit(msgContent + "." + currentText).then(botMessage => {
				    	if(power == 1) {
				    		if(chunk >= chunkList.length-1) {
				    			awaitNextTossup();
				    			return;
				    		}
				    		
							readTu(msg, connection, powerChunk, chunk+1, 1, botMessage)
				    	}

				    	if(chunk >= chunkList.length-1 && power == 0) {
				    		readTu(msg, connection, powerChunk, 0, 1, botMessage)
				    	} else if (power == 0) {
				    		readTu(msg, connection, powerChunk, chunk+1, 0, botMessage)
				    	}

		    	})
		    });  

		    await sleep(1000);
		    if(!connection.speaking.bitfield == 1) {

		    	readTu(msg, connection, powerChunk, chunk, power, botMessage, buzzMessage);
		    }

}



const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))
async function readTossups(msg, channel, connection) {
	var i=-1;
	while (getVar(msg, "gameBeingPlayed")) {
		if(i != getVar(msg, "readingTu")) {
			clearBuzzes(msg);
			i = getVar(msg, "readingTu");
			while (!compliesWithDifficulty(tossups[i].tournament_id, difficultyList)) {
				tossups.splice(i, 1); 
			}



			setVar(msg, "curAnswer", tossups[i]["formatted_answer"]);//.substring(0, tossups[i]["formatted_answer"].lastIndexOf("&lt"))
			setVar(msg, "canPowerThisTossup", 1);
			if(tossups[i]["text"].lastIndexOf("*") == -1) {
				setVar(msg, "canPowerThisTossup", 0);
			} 

			channel.send("TU " + (i+1) + ":").then(message => readTu(msg, connection, tossups[i]["text"].split("*"), 0, 0, message));

			
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

function playersCanBuzz(msg) {
	if(getVar(msg, "allowBuzzMultipleTimes")) return true;

	for(var i = 0; i < getVar(msg, "players").length; i++) {
		if(!getVar(msg, "players")[i][2]) return true;
	}
	return false;
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

function clearBuzzes(msg) {
	for(i=0;i<getVar(msg, "players").length;i++) {
		getVar(msg, "players")[i][2] = false
	}
}

function judgeAnswer(msg) {

	answers = getUnderlined(getVar(msg, "curAnswer"), [])


	for(i = 0; i < answers.length; i++) {
		if(msg.content.toLowerCase() == answers[i].toLowerCase()) {
			return true;
		}
	}



	return false;
}



async function handleCooldown(msg, userID) {
	for(i = 0; i < getVar(msg, "plrTimeout").length; i++) {
		if(getVar(msg, "plrTimeout")[i][0] == userID) {
			
			i_var = i;
			while (getVar(msg, "plrTimeout")[i_var][3] > 0) {
				var newPlrTimeoutList = getVar(msg, "plrTimeout");
				newPlrTimeoutList[i_var][3] = newPlrTimeoutList[i_var][3] - 500;
				setVar(msg, "plrTimeout", newPlrTimeoutList)
				await sleep(500);
			}

			var newPlrTimeoutList = getVar(msg, "plrTimeout");
			newPlrTimeoutList[i_var][1] = 0;
			newPlrTimeoutList[i_var][3] = 0;
			setVar(msg, "plrTimeout", newPlrTimeoutList)
		}
	}
}

function isTimedOut(msg, userID) {
	for(i = 0; i < getVar(msg, "plrTimeout").length; i++) {
		if(getVar(msg, "plrTimeout")[i][0] == userID) {
			if(getVar(msg, "plrTimeout")[i][2] == true) {
				return true;
			}
		}
	}
	return false;
}

function isPlayer(userID) {
	for(i = 0; i < players.length; i++) {
		if(players[i] == userID) {
			return true;
		}
	}
	return false;
}

function isInCategorylist(msg, categoryID) {
	for(var i = 0; i < getVar(msg, "category_list").length; i++) {
		if(getVar(msg, "category_list")[i] == categoryID) {
			return true;
		}
	}
	return false;
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function getEmojiFor(bool) {
	if(bool) {
		return ":white_check_mark:";
	} else {
		return ":x:";
	}
}



function getTournamentName(id) {
	for(var i = 0; i < tournament_mapping.length; i++) {
		if(tournament_mapping[i].id == id) {
			return tournament_mapping[i].name
		}
	}

	return "Tournament not found";
}

function compliesWithDifficulty(tournament_id, difficulty_list) {

	for(var i = 0; i < difficulty_list.length; i++) {
		difficulty_list[i] = parseInt(difficulty_list[i]);
	}

	for(var i = 0; i < tournament_mapping.length; i++) {
		if(tournament_mapping[i].id == tournament_id) {
			for(var j = 0; j < difficulty_list.length; j++) {
				if(difficulty_list[j] == tournament_mapping[i].difficulty) {return true;}
			}
		}
	}

	return false;	
}

async function countUptime() {
	await sleep(1000);
	uptimeSeconds++;
	countUptime();
}

function getDifficulty(tournament_id) {
	for(var i = 0; i < tournament_mapping.length; i++) {
		if(tournament_mapping[i].id == tournament_id) {
			return tournament_mapping[i].difficulty
		}
	}
}

function formatTime(seconds_int) {
	var sec = seconds_int;
	var min = 0;
	var hr = 0;

	while(sec >= 60) {
		sec = sec - 60;
		min++;
		if(min >= 60) {
			min = 0;
			hr++;
		}
	}

	if(sec < 10) {sec = "0" + sec}
	if(min < 10) {min = "0" + min}
	if(hr < 10) {hr = "0" + hr}

	return hr + ":" + min + ":" + sec;
}

var onlineMessages = ["/help", "Reading for " + playersCurrentlyInGame + " player(s)", version, "Online for " + formatTime(uptimeSeconds)]
function getOnlineMessage(index) {
	onlineMessages = ["/help", "Reading for " + playersCurrentlyInGame + " player(s)", version, "Online for " + formatTime(uptimeSeconds)]
	return onlineMessages[index];
}


async function rotateOnlineMessage(index) {
	var timeWaited = 0;
	var timeToWait = 7500;
	var savedMsg = "";
	while(timeWaited < timeToWait) {
		await sleep(250);
		timeWaited = timeWaited + 250;
		if(savedMsg != getOnlineMessage(index)) {
			client.user.setActivity(getOnlineMessage(index), {
			  type: "WATCHING"
			});
			savedMsg = getOnlineMessage(index);
		}
	}

	index = index % onlineMessages.length;
	rotateOnlineMessage(index+1);
}



client.on('ready', () => {
  load();
  loadTournamentMapping();
  console.log('I am ready!');
  countUptime();
  rotateOnlineMessage(0);
});



// Create an event listener for messages
client.on('message', async msg => {
  // Voice only works in guilds, if the message does not come from a guild,
  // we ignore it
  if (!msg.guild) return;

  if(!varSetExists(msg)) {
  	console.log("Created gamedata set for " + msg.guild.id)
  	gameData[msg.guild.id] = createEmptyServerData();
  	setVar(msg, "readingTextChannel", msg.channel.id)
  }

  if(isTimedOut(msg, msg.author.id)) return;


  if(!msg.author.bot && (!(getVar(msg, "canTalk") || getVar(msg, "allowTalkingDuringGame")) || msg.content.startsWith("/"))) {
  	for(var i = 0; i < getVar(msg, "players").length; i++) {
  		if(getVar(msg, "players")[i][0] == msg.author.id) { 

  			var intimeout = false;

		  	for(var j = 0; j < getVar(msg, "plrTimeout").length; j++) {

		  		if(getVar(msg, "plrTimeout")[j][0] == getVar(msg, "players")[i][0]) {
		  			intimeout = true;
		  			var newPlrTimeoutList = getVar(msg, "plrTimeout");
		  			newPlrTimeoutList[j][1] = newPlrTimeoutList[j][1] + 1;
		  			setVar(msg, "plrTimeout", newPlrTimeoutList);

		  			if(getVar(msg, "plrTimeout")[j][3] <= 0) {
		  				var newPlrTimeoutList = getVar(msg, "plrTimeout");
		  				newPlrTimeoutList[j][3] = 2500;
		  				setVar(msg, "plrTimeout", newPlrTimeoutList);
		  				handleCooldown(msg, getVar(msg, "plrTimeout")[j][0]);
		  			}
		  			

		  			if(getVar(msg, "plrTimeout")[j][1] >= 7) {
		  				var newPlrTimeoutList = getVar(msg, "plrTimeout");
		  				newPlrTimeoutList[j][2] = true;
		  				setVar(msg, "plrTimeout", newPlrTimeoutList);
		  				msg.reply("Please stop flooding the bot. The bot will react to your commands and messages again in 5 seconds.");
		  				j_var = j;
		  				setTimeout(function(){ 
		  					var newPlrTimeoutList = getVar(msg, "plrTimeout");
		  					newPlrTimeoutList[j_var][2] = false;
		  					newPlrTimeoutList[j_var][1] = 0;
		  					newPlrTimeoutList[j_var][3] = 0;
		  					setVar(msg, "plrTimeout", newPlrTimeoutList);
		  				}, 5000);
		  			}

		  		}
  			}

  			if(intimeout == false) {
  				var newPlrTimeoutList = getVar(msg, "plrTimeout");
  				newPlrTimeoutList.push([msg.author.id, 0, false, 0]);
  				setVar(msg, "plrTimeout", newPlrTimeoutList);
  			}
	  	}
	  }
	}


  const args = msg.content.slice(prefix.length).trim().split(' ');
  const command = args.shift().toLowerCase();



  if (command === "pause") {
  	if(!getVar(msg, "isPaused")) {
  		getVar(msg, "botVoiceConnection").play("./pause.mp3");
  		msg.channel.send(":pause_button: Game paused. use **/play** to continue.")
  		setVar(msg, "isPaused", true)
  	}
  	msg.delete();
  }


  if (command === "stop") {

  	setVar(msg, "gameBeingPlayed", false)
  	getVar(msg, "botVoiceConnection").play("./pause.mp3");
  	msg.channel.send(":x: Game finished.");

   	pString = "";

  	for(i = 0; i < getVar(msg, "players").length; i++) {
  		pString = pString + client.users.cache.get(getVar(msg, "players")[i][0]).username + " : " + getVar(msg, "players")[i][1] + "\n";
  	}


  	  const embed = new Discord.MessageEmbed()
		.setColor('#00ff00')
		.setTitle('Final Score')
		.setDescription("Tossups played : " + (getVar(msg, "readingTu") + 1))
		.addField('Player : Score', pString, false)
  	msg.channel.send(embed);
  	msg.guild.members.cache.get(client.user.id).voice.channel.leave();


	playersCurrentlyInGame = playersCurrentlyInGame - getVar(msg, "players").length;
  	setVar(msg, "players", []);
  	
  }



  if (command === "skip") {
  	if(!getVar(msg, "isPaused")) {
  		getVar(msg, "botVoiceConnection").play("./pause.mp3");
  		setVar(msg, "readingTu", getVar(msg, "readingTu") + 1);
  	}
  	msg.delete();
  }

  if(command === "scorecheck" || command === "sc") {

  	pString = "";

  	for(i = 0; i < getVar(msg, "players").length; i++) {
  		var userName = msg.guild.members.cache.get(getVar(msg, "players")[i][0]).nickname;
  		pString = pString + userName + " : " + getVar(msg, "players")[i][1] + "\n";
  	}


  	  const embed = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle('Scorecheck')
		.setDescription('Tossup ' + getVar(msg, "readingTu") + 1)
		.addField('Player : Score', pString, false)
  	msg.channel.send(embed);
  }

  if (command === "settings") {
  	if(args[0] === "list") {
  	  const embed = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle('Settings')
		.setDescription("Customize your playing experience here.")
		.addField('Base rules', getEmojiFor(getVar(msg, "allowBuzzMultipleTimes")) + " - Allow multiple buzzes per tossup [AllowMultipleBuzz]\n" + getEmojiFor(getVar(msg, "allowTalkingDuringGame")) + " - Allow talking during the reading of tossups. [AllowTalk]\n" + getEmojiFor(getVar(msg, "enableCelebration")) + " - Enable the 'celebration' that pops up when a player reaches a point multiple of 100 [AllowCelebration]")
		.addField('Timing', "**" + getVar(msg, "buzzTime") + "ms** - Time given after buzz before being negged. [BuzzTime]\n**" + getVar(msg, "protestTimeout") + "ms** - Time given to protest or confirm an answer before it is automatically ruled as upheld. [ProtestTime]");
  		msg.channel.send(embed)
  	}

  	if(args[0] === "edit") {
  		if(args[1] == "AllowMultipleBuzz") {
  			if(args[2] == "true") {
  				setVar(msg, "allowBuzzMultipleTimes", true)
  			} else if(args[2] == "false") {
  				setVar(msg, "allowBuzzMultipleTimes", false)
  			}
  		}

  		if(args[1] == "AllowTalk") {
  			if(args[2] == "true") {
  				setVar(msg, "allowTalkingDuringGame", true)
  			} else if(args[2] == "false") {
  				setVar(msg, "allowTalkingDuringGame", false)
  			}
  		}

   		if(args[1] == "AllowCelebration") {
  			if(args[2] == "true") {
  				setVar(msg, "enableCelebration", true)
  			} else if(args[2] == "false") {
  				setVar(msg, "enableCelebration", false)
  			}
  		}

  		if(args[1] == "BuzzTime") {
  			setVar(msg, "buzzTime", parseInt(args[2]))
  		}

  		if(args[1] == "ProtestTime") {
  			setVar(msg, "protestTimeout", parseInt(args[2]))
  		}
  	}
  }

  if (command === "play") {
  	if(getVar(msg, "isPaused")) {
  		msg.channel.send(":arrow_right: Game will resume in **3** seconds.").then(message => {
  			setTimeout(function(){ 
  				setVar(msg, "isPaused", false)
  				message.delete();
				if(getVar(msg, "currentTuCanTimeout") == true) {
					readTu(msg, getVar(msg, "botVoiceConnection"), getVar(msg, "curPC"), getVar(msg, "curC"), getVar(msg, "curP"), getVar(msg, "curBM"));
				}
  			}, 3000);
  		})
  		
  	}
  }

  if (command === "buzz") {
  	var thisPlayerBuzzed = false;

	for(i=0;i<getVar(msg, "players").length;i++) {
		if(getVar(msg, "players")[i][0] == msg.author.id && getVar(msg, "players")[i][2]) {
			thisPlayerBuzzed = true;
		}
	}




  	if(msg.guild.members.cache.get(client.user.id).voice.channel == msg.member.voice.channel) {
  		console.log("bruh")
  		if(!thisPlayerBuzzed || getVar(msg, "allowBuzzMultipleTimes")) {
  			console.log("bruh2")
		  	var joined=false;
		  	if(getVar(msg, "canBuzz") && !getVar(msg, "isPaused")) {
			  	for(i=0;i<getVar(msg, "players").length;i++) {
			  		if(getVar(msg, "players")[i][0] == msg.author.id) {
			  			getVar(msg, "players")[i][2] = true;
			  			joined=true;		  		
			  			setVar(msg, "canBuzz", false);
			  			msg.reply(" has buzzed! :bulb:").then(message => {
			  				
				  			setVar(msg, "buzz", msg.author);
				  			getVar(msg, "botVoiceConnection").play("./buzz.mp3");
				  			setVar(msg, "timeOut", true)
				  			var currentBuzz = msg.author.id;
				  			setTimeout(function(){ 
				  				message.delete();
				  				if(getVar(msg, "timeOut") == true && currentBuzz == getVar(msg, "buzz").id) {
									msg.channel.send(":x: Time is up. **-5** points");
									setVar(msg, "canBuzz", true)
									for(i=0;i<getVar(msg, "players").length;i++) {
										if(getVar(msg, "players")[i][0] == msg.author.id) {
											var newPlayerList = players;
										  	newPlayerList[i][1] = newPlayerList[i][1] - 5;
										  	setVar(msg, "players", newPlayerList)
										}
									}
									setVar(msg, "buzz", null);
									if(getVar(msg, "currentTuCanTimeout") == false) {
										readTu(msg, getVar(msg, "botVoiceConnection"), getVar(msg, "curPC"), getVar(msg, "curC"), getVar(msg, "curP"), getVar(msg, "curBM"));
									}
				  				}
				  				//msg.delete();
				  			 }, getVar(msg, "buzzTime"));
			  			})
			  		}
			  	}

			  	if(joined == false) {
			  		msg.reply("join with /join first!");
			  	}
		  	} 

		} else {
			msg.reply("You cannot buzz more than once during a tossup.").then(message => {
				setTimeout(function(){ message.delete(); }, 1500);
			})
			
		}

  	} else {
  		msg.reply("You need to be in the bot's voice channel to buzz!");
  	}

  }

  if(command === "join") {

	if(msg.guild.members.cache.get(client.user.id).voice.channel == msg.member.voice.channel) {
	  	var joined=false;
	  	for(i=0;i<getVar(msg, "players").length;i++) {
	  		if(getVar(msg, "players")[i][0] == msg.author.id) {
	  			joined=true;
	  		}
	  	}

	  	if(joined == false) {
	  		var newPlayerList = getVar(msg, "players");
		  	newPlayerList.push([msg.author.id, 0, false]);
		  	setVar(msg, "players", newPlayerList);
		  	playersCurrentlyInGame++;
		  	msg.reply("added as a player");
	  	}
	} else {
		msg.reply("You can only join a game if you are in the bot's voice channel!")
	}





  }

  if(command === "leave") {
  	for(i=0;i<getVar(msg, "players").length;i++) {
  		if(getVar(msg, "players")[i][0] == msg.author.id) {
  			var newPlayerList = getVar(msg, "players");
  			newPlayerList.splice(i, 1);
  			setVar(msg, "players", newPlayerList);
  			playersCurrentlyInGame--;
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
		.addField('Customization', 'Before beginning reading, customize what questions you would like to hear with these commands:\n/category add [category_name] - Add a category to the category queue.\n/category remove [category_name] - remove a category from the category queue.\n/difficulty [1-9] - Set difficulty of tossups using the QuizDB difficulty scale', false)
		.addField('Rules', "This bot uses NAQT rules. 15 points power, 10 point tu, and -5 on negs.\nUpon buzzing, you will be recognized and any messages from other players will be deleted. Enter your answer to proceed. You will automatically be negged after __7__ seconds if you do not provide an answer.", false)
		.addField('Protests', "When you give an answer to a tossup, the bot will message you to ensure that your answer should have been accepted or not. Pressing the reaction will overrule the decision of the bot. You can then return to the game room via the url provided.", false)
		.addField('Development', "These commands will be removed in the final release.\n/restart - This will restart the bot process in case it bugs.", false)
  	msg.channel.send(embed);
  }


  if(command === "cat" || command === "category") {
  	console.log("Before iterating: " + category_mapping.length);
  	var cmdArg = args.shift().toLowerCase();
  	var arg = args.join(" ");
  	if(cmdArg == "add") {
  		catExists = false;
  		for (var i = 0; i < category_mapping.length; i++) {
  			console.log(category_mapping[i]["name"]);
  			if(arg.toLowerCase() === category_mapping[i]["name"].toLowerCase()) {
	  			if(!isInCategorylist(msg, category_mapping[i]["id"])) {
	  				var newCategoryList = getVar(msg, "category_list");
	  				newCategoryList.push(category_mapping[i]["id"]);
	  				setVar(msg, "category_list", newCategoryList)
	  				catExists = true;
	  			}
  			}
  		}

  		console.log("After iterating: " + category_mapping.length);

  		if(catExists) {
  			msg.reply("added category " + arg + ".");
  		} else {
  			msg.reply("category '" + arg + "' does not exist.");
  		}

  	}

  	if(cmdArg == "reset") {
  		setVar(msg, "category_list", [])
  		msg.reply("Category list reset");
  	}

  	if(cmdArg == "remove" || cmdArg == "rm") {
  		catRemoved = false;
  		for (var i = 0; i < category_mapping.length; i++) {
  			if(arg.toLowerCase() == category_mapping[i].name.toLowerCase()) {
				const index = getVar(msg, "category_list").indexOf(category_mapping[i].id);
				if (index > -1) {
					var newCategoryList = getVar(msg, "category_list");
					newCategoryList.splice(index, 1);
					setVar(msg, "category_list", newCategoryList)
					catRemoved = true;
				}
  			}
  		}

  		if(catRemoved) {
  			msg.reply("removed category " + arg + ".");
  		} else {
  			msg.reply("category '" + arg + "' does not exist or is not in the current category list.");
  		}

  	}
  }

  if(command === "diff" || command === "difficulty") {
	  difficultyList = args[0].split("+");
	  msg.reply("set difficulty to " + args[0]);  
  }


  if (command === "read") {
  	setVar(msg, "readingTextChannel", msg.channel.id)
  	var joined=false;
  	for(i=0;i<getVar(msg, "players").length;i++) {
  		if(getVar(msg, "players")[i][0] == msg.author.id) {
  			joined=true;
  		}
  	}

  	if(joined == false) {
	  	var newPlayerList = getVar(msg, "players");
		newPlayerList.push([msg.author.id, 0, false]);
		setVar(msg, "players", newPlayerList);
	  	playersCurrentlyInGame++;
	  	msg.reply("added as a player");
  	}
  	setVar(msg, "readingTu", 0);
    // Only try to join the sender's voice channel if they are in one themselves
    if(getVar(msg, "category_list").length > 0) {
	    if (msg.member.voice.channel) {
	    	if(!getVar(msg, "gameBeingPlayed"))  {
	    	  	setVar(msg, "gameBeingPlayed", true)
	    	
		    	
		    	category_query = getVar(msg, "category_list").join(" OR category_id = ");

		    	pool.query("SELECT * FROM tossups WHERE category_id = " + category_query, (err, res) => {
				  tossups = shuffle(res.rows);
				})

				const voiceChannel = msg.member.voice.channel;
			    voiceChannel.join().then(connection => {
			    	setVar(msg, "botVoiceConnection", connection)

			    	setTimeout(function(){
		    			readTossups(msg, msg.channel, connection);
		    		}, 3000);

		    	});

		   
			} else {
				msg.reply('A game is already being played');
			}
	    } else {
	      msg.reply('You need to join a voice channel first!');
	    }
	} else {
		msg.reply("Add a category to read with /cat add [category name]");
	}
    msg.delete();
  }



  if (command === "devnote") {
  	if(msg.author.id == 188031012444307457) {
	  	restartAcknowledgeMessage = restartAcknowledgeMessage + "\n" + args.join(" ");
	  	msg.delete();
  	}
  }

  if (command === "ga" || command === "globalannounce") {
  	if(msg.author.id == 188031012444307457) {
  		console.log("right player")
  		for(var i = 0; i < client.guilds.cache.keyArray().length; i++) {
  			if(gameData[client.guilds.cache.keyArray()[i]] != null) {
  				console.log("right server")
  				if(gameData[client.guilds.cache.keyArray()[i]].readingTextChannel != null) {
  					console.log("right channel")
  					embed = new Discord.MessageEmbed()
					.setColor('#ff00ff')
					.setTitle("Global announcement")
					.setDescription(args.join(" "))
  					client.channels.cache.get(gameData[client.guilds.cache.keyArray()[i]].readingTextChannel).send(embed).then(message => {
  						msg.delete();
  					})
  				}
  			}
  		}
  	}
  }

  if (command === "restart") {
  	var embed = null;
  	if(restartAcknowledgeMessage != "") {
  		embed = new Discord.MessageEmbed()
		.setColor('#ff0000')
		.setTitle(":warning: Restart :warning:")
		.setDescription("Are you sure you wish to restart the bot?")
		.addField("Changes applied on restart", restartAcknowledgeMessage)
  	} else {
	
		embed = new Discord.MessageEmbed()
		.setColor('#ff0000')
		.setTitle(":warning: Restart :warning:")
		.setDescription("Are you sure you wish to restart the bot?")
	}

		msg.channel.send(embed).then(message => {
			message.react("✅");
  			const filterY = (reaction, user) => {
				return reaction.emoji.name === '✅' && !msg.author.bot;
			};

			message.awaitReactions(filterY, { max: 2, time: 15000, errors: ['time'] })
				.then(collected => {
			  		msg.reply(" The bot will restart shortly. If you are restarting because of a bug, consider filling out this form: \nhttps://forms.gle/Uy6pPeT9fbkUveaQ9").then(restart => {
			  			saveAndExit();
			  		})
					
				}).catch(collected => {
					msg.reply("Aborted the restart.");
				});	
  		});

  }


  if(msg.author == getVar(msg, "buzz")) {
  	setVar(msg, "timeOut", false);
  	setVar(msg, "buzz", null);
  	if(judgeAnswer(msg) == false) {
  		setVar(msg, "canTalk", true)
  		msg.channel.send(":x: Incorrect. **-5** points").then(message => {



  			const exampleEmbed = new Discord.MessageEmbed()
			.setColor('#ff0000')
			.setTitle('Protest Resolver')
			.setDescription('React with :white_check_mark: if your answer should have been marked as correct. Otherwise, if the ruling **__is correct__** then react with :x:.')
			.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
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

				protestDM.awaitReactions(filterN, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
				.then(collected => {
					if(canProtest) {
						canProtest = false;
						message.edit(":x: Incorrect. **-5** points");
							for(i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									var newPlayerList = getVar(msg, "players");
									 newPlayerList[i][1] = newPlayerList[i][1] - 5;
									 setVar(msg, "players", newPlayerList);
								}
							}
							if(playersCanBuzz(msg)) {
								if(getVar(msg, "currentTuCanTimeout") == false) {
									readTu(msg, getVar(msg, "botVoiceConnection"), getVar(msg, "curPC"), getVar(msg, "curC"), getVar(msg, "curP"), getVar(msg, "curBM"));
								}
							} else {


									const embed = new Discord.MessageEmbed()
									.setColor('#ff0000')
									.setTitle('Tossup ' + getVar(msg, "readingTu"))
									.setDescription("nobody got this tossup.")
									.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
									.setFooter(getTournamentName(tossups[getVar(msg, "readingTu")].tournament_id) + " // rd: " + tossups[getVar(msg, "readingTu")].round)
									getVar(msg, "curBM").channel.send(embed);

									getVar(msg, "curBM").edit(tossups[getVar(msg, "readingTu")]["text"]);
									setVar(msg, "currentTuCanTimeout", false)
									setVar(msg, "readingTu", getVar(msg, "readingTu") + 1);
								

							}
						setVar(msg, "canBuzz", true);
						setVar(msg, "buzz", null);
					}
				})

				protestDM.awaitReactions(filterY, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
					.then(collected => {
						if(canProtest) {
							canProtest = false;
							msg.channel.send(":+1: Judgement overriden. Protest accepted.");
							protestDM.channel.send(":+1: Judgement overriden. Protest accepted.");
							message.edit(":white_check_mark: Correct! **+" + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup")) + "** points");

							var userName = message.guild.members.cache.get(msg.author.id).nickname;

				  			const embed = new Discord.MessageEmbed()
							.setColor('#00ff00')
							.setTitle('Tossup ' + (getVar(msg, "readingTu") + 1))
							.setDescription(userName + " got this tossup.")
							.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
							.addField('Answer given: ', msg.content, false)
							.setFooter(getTournamentName(tossups[getVar(msg, "readingTu")].tournament_id) + " // rd:" + tossups[getVar(msg, "readingTu")].round)

							msg.channel.send(embed);
							getVar(msg, "curBM").edit(tossups[getVar(msg, "readingTu")]["text"]);
							for(i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									var newPlayerList = getVar(msg, "players");
									newPlayerList[i][1] = newPlayerList[i][1] + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup"));
									setVar(msg, "players", newPlayerList);
									if(getVar(msg, "players")[i][1] % 100 == 0 && getVar(msg, "enableCelebration")) {
										celebrate(msg, getVar(msg, "players")[i][0], getVar(msg, "players")[i][1]);
									}
								}
							}
							setVar(msg, "buzz", null);
							setVar(msg, "canBuzz", true);
							setVar(msg, "currentTuCanTimeout", false)
							setVar(msg, "readingTu", getVar(msg, "readingTu") + 1)
						}
					})
					.catch(collected => {
						if(canProtest) {
							canProtest = false;
							message.edit(":x: Incorrect. **-5** points");
							for(i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									var newPlayerList = getVar(msg, "players");
									newPlayerList[i][1] = newPlayerList[i][1] - 5;
									setVar(msg, "players", newPlayerList);
								}
							}


							if(playersCanBuzz(msg)) {
								if(getVar(msg, "currentTuCanTimeout") == false) {
									readTu(msg, getVar(msg, "botVoiceConnection"), getVar(msg, "curPC"), getVar(msg, "curC"), getVar(msg, "curP"), getVar(msg, "curBM"));
								}

							} else {

								const embed = new Discord.MessageEmbed()
								.setColor('#ff0000')
								.setTitle('Tossup ' + (getVar(msg, "readingTu")+1))
								.setDescription("nobody got this tossup.")
								.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
								.setFooter(getTournamentName(tossups[getVar(msg, "readingTu")].tournament_id) + " // rd: " + tossups[getVar(msg, "readingTu")].round)
								getVar(msg, "curBM").channel.send(embed);

								getVar(msg, "curBM").edit(tossups[getVar(msg, "readingTu")]["text"]);
								setVar(msg, "currentTuCanTimeout", false)
								setVar(msg, "readingTu", getVar(msg, "readingTu") + 1)
							}
							setVar(msg, "canBuzz", true);
							setVar(msg, "buzz", null);

						}
					});
			})
  		});


  	} else {

  		var curMsg = null;
  		setVar(msg, "canTalk", true)

  		msg.channel.send(":white_check_mark: Correct! **+" + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup")) + "** points").then(message => {

  			const exampleEmbed = new Discord.MessageEmbed()
			.setColor('#00ff00')
			.setTitle('Protest Resolver')
			.setDescription('React with :x: if your answer should have been marked as incorrect. Otherwise, if the ruling **__is correct__** then react with :white_check_mark:.')
			.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
			.addField('Your answer: ', msg.content, false)
			.addField('Press this URL to return to the game room.', message.url, false)

			msg.author.send(exampleEmbed).then(protestDM => {
				var canProtest = true;
				protestDM.react("❌");
				protestDM.react("✅");
				message.edit(":white_check_mark: Correct! **+" + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup")) + "** points [Protest resolver: <" + protestDM.url + ">]")
				const filterY = (reaction, user) => {
					return reaction.emoji.name === '✅' && user.id === msg.author.id;
				};

				const filterN = (reaction, user) => {
					return reaction.emoji.name === '❌' && user.id === msg.author.id;
				};

				protestDM.awaitReactions(filterY, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
				.then(collected => {
					if(canProtest) {
						canProtest = false;
							message.edit(":white_check_mark: Correct! **+" + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup")) + "** points");
							var userName = message.guild.members.cache.get(msg.author.id).nickname;
				  			const embed = new Discord.MessageEmbed()
							.setColor('#00ff00')
							.setTitle('Tossup ' + (getVar(msg, "readingTu")+1))
							.setDescription(userName + " got this tossup.")
							.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
							.addField('Answer given: ', msg.content, false)
							.setFooter(getTournamentName(tossups[getVar(msg, "readingTu")].tournament_id) + " // rd: " + tossups[getVar(msg, "readingTu")].round)
							msg.channel.send(embed);
							getVar(msg, "curBM").edit(tossups[getVar(msg, "readingTu")]["text"]);

							for(i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									var newPlayerList = getVar(msg, "players");
									newPlayerList[i][1] = newPlayerList[i][1] + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup"));
									setVar(msg, "players", newPlayerList);
									if(getVar(msg, "players")[i][1] % 100 == 0 && getVar(msg, "enableCelebration")) {
										celebrate(msg, getVar(msg, "players")[i][0], getVar(msg, "players")[i][1]);
									}
								}
							}
							setVar(msg, "readingTu", getVar(msg, "readingTu") + 1)
							setVar(msg, "currentTuCanTimeout", false)
							setVar(msg, "canBuzz", true);
							setVar(msg, "buzz", null);
					}
				})

				protestDM.awaitReactions(filterN, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
					.then(collected => {
						if(canProtest) {
							canProtest = false;
							
							msg.channel.send(":+1: Judgement overriden. Continuing tossup.");
							protestDM.channel.send(":+1: Judgement overriden. Continuing tossup.");
							message.edit(":x: Incorrect. **-5** points");

							for(i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									var newPlayerList = getVar(msg, "players");
									newPlayerList[i][1] = newPlayerList[i][1] - 5;
									setVar(msg, "players", newPlayerList);
								}
							}


							if(playersCanBuzz()) {
								if(getVar(msg, "currentTuCanTimeout") == false) {
									readTu(msg, getVar(msg, "botVoiceConnection"), getVar(msg, "curPC"), getVar(msg, "curC"), getVar(msg, "curP"), getVar(msg, "curBM"));
								}
							} else {
								const embed = new Discord.MessageEmbed()
								.setColor('#ff0000')
								.setTitle('Tossup ' + (getVar(msg, "readingTu")+1))
								.setDescription("nobody got this tossup.")
								.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
								.setFooter(getTournamentName(tossups[getVar(msg, "readingTu")].tournament_id) + " // rd: " + tossups[getVar(msg, "readingTu")].round)
								getVar(msg, "curBM").channel.send(embed);

								getVar(msg, "curBM").edit(tossups[getVar(msg, "readingTu")]["text"]);
								setVar(msg, "currentTuCanTimeout", false)
								setVar(msg, "readingTu", getVar(msg, "readingTu") + 1)
							}
							setVar(msg, "canBuzz", true);
							setVar(msg, "buzz", null);

						}
					})
					.catch(collected => {
						if(canProtest) {
							canProtest = false;
							message.edit(":white_check_mark: Correct! **+" + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup")) + "** points");
							var userName = message.guild.members.cache.get(msg.author.id).nickname;
				  			const embed = new Discord.MessageEmbed()
							.setColor('#00ff00')
							.setTitle('Tossup ' + (getVar(msg, "readingTu")+1))
							.setDescription(msg.author.username + " got this tossup.")
							.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
							.addField('Answer given: ', msg.content, false)
							.setFooter(getTournamentName(tossups[getVar(msg, "readingTu")].tournament_id) + " // rd: " + tossups[getVar(msg, "readingTu")].round)
							msg.channel.send(embed);
							getVar(msg, "curBM").edit(tossups[getVar(msg, "readingTu")]["text"]);

							for(i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									var newPlayerList = getVar(msg, "players");
									newPlayerList[i][1] = newPlayerList[i][1] + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup"));
									setVar(msg, "players", newPlayerList);
									if(getVar(msg, "players")[i][1] % 100 == 0 && getVar(msg, "enableCelebration")) {
										celebrate(msg, getVar(msg, "players")[i][0], getVar(msg, "players")[i][1]);
									}
								}
							}
							setVar(msg, "currentTuCanTimeout", false)
							setVar(msg, "readingTu", getVar(msg, "readingTu") + 1)
							setVar(msg, "canBuzz", true);
							setVar(msg, "buzz", null);
							
						}
					});
			})
  		});
  	}
  } else {
  	if(getVar(msg, "buzz") != null || getVar(msg, "isPaused") == false) {
  	for(i=0;i<getVar(msg, "players").length;i++) {
  		if(getVar(msg, "players")[i][0] == msg.author.id) {
  			if(getVar(msg, "canTalk") || getVar(msg, "allowTalkingDuringGame") || msg.channel.id != getVar(msg, "readingTextChannel")) {}
  			else {
  				msg.delete();
  			}
  		}
  	}
  	}
  }

});

// Log our bot in using the token from https://discord.com/developers/applications
client.login('Mjk0ODg5ODc1OTQ0MTEyMTI4.WNVbmQ.W8kLE207tu_qBO4RqERE1ChgZZw');