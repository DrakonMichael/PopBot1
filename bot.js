
// Import the discord.js module
const Discord = require('discord.js');
const discordTTS=require("discord-tts");



// Create an instance of a Discord client
const client = new Discord.Client();
const category_mapping = require("./category_mapping.json");
var tournament_mapping = [];
var subcategory_mapping = [];

const { Pool, Client } = require('pg')
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'betterqb',
  password: 'postgres',
  port: 5432,
})

var fs = require('fs');
var stringSimilarity = require('string-similarity');

const fsPromises = fs.promises;



// Changelog: 1.5.0
// 
// + Added presets.

// Dev note: Some complications have made it not possible to change the way I get the text to speech data for the bot. As such, I'm going to be looking into how to make this possible, and this change has been pushed back.


// LOCAL VARS -- will be put into txt or json files so concurrent play exists.

// persistent data - allowBuzzMultipleTimes, allowTalkingDuringGame, enableCelebartion, buzzTime, protestTimeout

//GLOBAL VARS

var category_shortcuts = {"lit": "Literature", "geo":"Geography", "fa": "Fine Arts", "sci":"science", "hist":"history", "myth": "mythology", "ce":"current events", "philo":"philosophy", "ss":"social science", "barrington":"trash"}
var subcat_shortcuts = {"av": "audiovisual", "afa":"auditory", "vfa": "visual", "brit":"british", "euro":"european", "gr": "greco-roman", "oea":"other east asian", "ea":"east asian", "jewish":"judaism", "bio":"biology", "chem":"chemistry", "cs":"computer science", "phys":"physics", "econ":"economics", "ling":"linguistics", "lingo":"linguistics", "psych":"psychology", "tv":"television", "roxanne":"classical"}
var public_presets = {};
var blacklist = {};

var gist_token = ""

const GistClient = require("gist-client")
const gistClient = new GistClient()

var prefix = "/";
var gameData = {}
var playersCurrentlyInGame = 0;
var version = "BETA v1.5.0a";
var uptimeSeconds = 0;
var restartAcknowledgeMessage = "";
var maxTeamsAllowed = 10;

async function saveAndExit() {
	console.log(gameData);
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

  for(var i = 0; i < Object.keys(gameData).length; i++) {
  	var newJson = createEmptyServerData();
  	var oldObj = gameData[Object.keys(gameData)[i]]
  	newJson.allowBuzzMultipleTimes = oldObj.allowBuzzMultipleTimes;
  	newJson.allowTalkingDuringGame = oldObj.allowTalkingDuringGame;
  	newJson.enableCelebration = oldObj.enableCelebration;
  	newJson.buzzTime = oldObj.buzzTime;
  	newJson.protestTimeout = oldObj.protestTimeout;
  	newJson.prefix = oldObj.prefix;
  	newJson.presets = oldObj.presets;

  	gameData[Object.keys(gameData)[i]] = newJson;
  }

  blacklist = require("./blacklist.json");
  public_presets = require("./public_presets.json");
}

function createEvent(name, lines, time) {
	var json = 	{
			"eventName":name,
			"timestamp":time,
			"lines":lines
		}
	return json;
}

function createEmptyServerData() {
	var json = 
		{
			"readingTu":0, 
			"buzz":null,
			"timeoutTimer":null,
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
			"pingTimeout":600000,
			"canUsePing":true,
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
			"buzzTime":10000,
			"bonusTime":15000,
			"protestTimeout":7500,
			"difficultyList": [],
			"tossups": [],
			"bonuses": [],
			"enableBonuses":true,
			"teams": {},
			"readingUntilTu":-1,
			"chunkList":[],
			"events":[],
			"prefix":"/",
			"presets":{}
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
	while (getVar(msg, "currentTuTimeout") < getVar(msg, "tuTimeout")) {
		await sleep(100);
		setVar(msg, "currentTuTimeout", getVar(msg, "currentTuTimeout") + 100);

		if(getVar(msg, "isPaused")) {
			setVar(msg, "currentTuTimeout", 0)
		}

		if(getVar(msg, "buzz") != null) {
			setVar(msg, "currentTuTimeout", -1 * getVar(msg, "protestTimeout"));
		}


	}

	if(getVar(msg, "currentTuCanTimeout") == true) {

		const embed = new Discord.MessageEmbed()
		.setColor('#ff0000')
		.setTitle('Tossup ' + (getVar(msg, "readingTu")+1))
		.setDescription("nobody got this tossup.")
		.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
		.setFooter(getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round)
		getVar(msg, "curBM").channel.send(embed).then(timeoutMessage => {
			addEvent(msg, "tossup " + (getVar(msg, "readingTu")+1) + " went dead.", timeoutMessage.createdTimestamp, ["	-- Text: " + getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"], "	-- Answer: " + getVar(msg, "curAnswer"), "	-- INFO: " + getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round]);
		})

		getVar(msg, "curBM").edit(getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"]);
		setVar(msg, "readingTu", getVar(msg, "readingTu")+1);
		

		setVar(msg, "currentTuCanTimeout", false)
	}
}

function loadTournamentMapping() {

	pool.query("SELECT * FROM tournaments", (err, res) => {
									
		tournament_mapping = res.rows;

	})

}

function setDifficulty(msg, str) {
		var intList = str.split("+")
		for(var i = 0; i < intList.length; i++) {
			var int = parseInt(intList[i])
			if(intList[i].length == 1) {
  			if(!isNaN(int)) { 
	  			if(int < 1 || int > 9) {
					msg.reply("Please enter a valid difficulty.");
					return;
	  			}
  			} else {
				msg.reply("Please enter a valid difficulty.");
				return;
  			}
			} else {
			msg.reply("Please enter a valid difficulty.");
			return;
			}

		}
		
  	setVar(msg, "difficultyList", str.split("+"))
	msg.reply("set difficulty to " + str);  
}

function loadSubcatMapping() {
	pool.query("SELECT * FROM subcategories", (err, res) => {
									
		subcategory_mapping = res.rows;

	})
}

function celebrate(message, userID, score) {
		const embed = new Discord.MessageEmbed()
		.setColor('#ffd700')
		.setTitle("**" + message.guild.members.cache.get(userID).nickname + "** has reached __**" + score + "**__ points!")

	message.channel.send(embed)
}

function sendDebug(msg, text) {
	msg.channel.send("**DEBUG** || " + text)
}

async function readTu(msg, connection, powerChunk, chunk, power, botMessage, buzzMessage, canPowerThisTossup) {

		//console.log("\n" + getVar(msg, "curPC"))
		//console.log(" --- // " + getVar(msg, "curP") + " --> " + power)
		//console.log(" >>> // " + getVar(msg, "curC") + " --> " + chunk)


		var addBuzzerButton = false;
		for(var j = 0; j < getVar(msg, "players").length; j++) {
			if(getVar(msg, "players")[j][3].mobile == 1) {
				addBuzzerButton = true;
			}
		}

		if(addBuzzerButton && botMessage.reactions.cache.size == 0) {
			botMessage.react("💡");

			const filter = (reaction, user) => {
				for(var j = 0; j < getVar(msg, "players").length; j++) {
					if(getVar(msg, "players")[j][0] == user.id) {
						return (getVar(msg, "players")[j][3].mobile == 1 && reaction.emoji.name === '💡' && user.bot == false)
					}
				}
				return false;
			};

			botMessage.awaitReactions(filter, {max: 1})
			.then(collected => {
				handleBuzz(msg, (collected.first().users.cache.filter(u => u.bot == false).first().id));
			}).catch(collected => console.log(collected))
		}





		if(getVar(msg, "isPaused")) return;
		setVar(msg, "canTalk", false)
		setVar(msg, "curPC", powerChunk);
		setVar(msg, "curC", chunk);
		setVar(msg, "curP", power);
		setVar(msg, "curBM", botMessage);


		setVar(msg, "chunkList", getVar(msg, "curPC")[getVar(msg, "curP")].split("."));
		//console.log(chunkList);
		//console.log(" /// // " + (chunkList.length-1) + "\n");
		setVar(msg, "chunkList", getVar(msg, "chunkList").filter(txt => txt != ""))

		var msgContent = getVar(msg, "curBM").content;

		
		
		var currentText = ""



		if (typeof getVar(msg, "chunkList")[getVar(msg, "curC")] != 'undefined') {

			if(getVar(msg, "chunkList")[getVar(msg, "curC")].length > 200) {
				var thisChunk = getVar(msg, "chunkList")[getVar(msg, "curC")].substring(0,200)
				var nextChunk = getVar(msg, "chunkList")[getVar(msg, "curC")].substring(200, getVar(msg, "chunkList")[getVar(msg, "curC")].length -1)
				getVar(msg, "chunkList")[getVar(msg, "curC")] = thisChunk;
				var newChunkList = getVar(msg, "chunkList")
				newChunkList.splice(getVar(msg, "curC")+1, 0, nextChunk);
				setVar(msg, "chunkList", newChunkList)
				console.log("Expanded.")
				console.log(getVar(msg, "chunkList"))

			}

			currentText = removeParentheses(getVar(msg, "chunkList")[getVar(msg, "curC")]);
		} else {
			currentText = ""
		}

		
		
		
		if(currentText == "") {
			awaitNextTossup(msg);
			return;
		} else {


		  	var stream = discordTTS.getVoiceStream(currentText);
		    var dispatcher = getVar(msg, "botVoiceConnection").play(stream);
		    dispatcher.on("finish",()=>{
		    	//
		    	getVar(msg, "curBM").edit(msgContent + "." + currentText).then(botMessage => {

				    	if(power == 1) {
				    		if(getVar(msg, "curC") >= getVar(msg, "chunkList").length-1) {
				    			awaitNextTossup(msg);
				    			return;
				    		}

							readTu(msg, getVar(msg, "botVoiceConnection"), getVar(msg, "curPC"), getVar(msg, "curC") + 1, 1, botMessage);
				    	}

				    	if(getVar(msg, "curC") >= getVar(msg, "chunkList").length-1 && getVar(msg, "curP") == 0) {
				    		var cpc = parseInt(getVar(msg, "curP"))+1
				    		if(typeof getVar(msg, "curPC")[cpc] != "undefined") {
				    			//sendDebug(msg, " changed to nonpower")
				    			readTu(msg, getVar(msg, "botVoiceConnection"), getVar(msg, "curPC"), 0, 1, botMessage);
				    		} else {
				    			awaitNextTossup(msg);
				    			return;
				    		}
				    		
				    	} else if (getVar(msg, "curP") == 0) {
				    		readTu(msg, getVar(msg, "botVoiceConnection"), getVar(msg, "curPC"), getVar(msg, "curC") + 1, 0, botMessage);
				    	}

		    	})
		    });  

		    await sleep(1000);
		    if(!getVar(msg, "botVoiceConnection").speaking.bitfield == 1) {
		    	readTu(msg, getVar(msg, "botVoiceConnection"), getVar(msg, "curPC"), getVar(msg, "curC"), getVar(msg, "curP"), getVar(msg, "curBM"));
		    }
		}

}

function getPlayer(msg, id) {
	for(var i=0;i<getVar(msg, "players").length;i++) {
  		if(getVar(msg, "players")[i][0] == id) {
  			return getVar(msg, "players")[i];
  		}
  	}

  	return false;
}

async function calculatePing(msg, totalPing, tries) {
    
	await sleep(1500);

    if(tries >= 15) {
    	var color = "#00ff00";

    	if((totalPing/tries) > 250) {
	    	color = "#ffff00";
	    }

	    if((totalPing/tries) > 500) {
	    	color = "#ff0000"
	    }

	    console.log(totalPing);
	    console.log(tries);

	    var newEmbed = new Discord.MessageEmbed()
	    .setTitle("Ping")
	    .setDescription("Round trip time average: " + (totalPing/tries).toFixed(0) + "ms\nOne-way websocket average ping: " + client.ws.ping + "ms")
	    .setFooter("This command can be used again in 10 minutes.")
	    .setColor(color)

	    msg.edit(newEmbed)
    } else {
	    var newEmbed = new Discord.MessageEmbed()
	    .setTitle("Ping (" + (tries + 1) + "/15)")
	    .setDescription("This may take up to 20 seconds.")
	    .setColor("#ffffff")

	    var oldEditTimestamp = msg.editedTimestamp || msg.createdTimestamp;
	    msg.edit(newEmbed).then(m => {
	    	var ping = (m.editedTimestamp - oldEditTimestamp) - 1500;
	    	calculatePing(m, totalPing + ping, tries + 1);
	    })
    }

}

function endGame(msg) {
 	setVar(msg, "gameBeingPlayed", false)
  	getVar(msg, "botVoiceConnection").play("./pause.mp3");
  	msg.channel.send(":x: Game finished.");

  	pString = "";

  	for(var ti = 0; ti < Object.keys(getVar(msg, "teams")).length; ti++) {
  		var team = Object.keys(getVar(msg, "teams"))[ti];
  		pString = pString + "**" + team + "** - __" + getVar(msg, "teams")[team].score + "__ [" + getPpbForName(msg, team) +  " PPB]\n";
  		for(i = 0; i < getVar(msg, "players").length; i++) {
  			if(getVar(msg, "players")[i][3].team == team) {
				var userName = msg.guild.members.cache.get(getVar(msg, "players")[i][0]).nickname;
				if(userName == null) {
					userName = client.users.cache.get(getVar(msg, "players")[i][0]).username;
				}
		  		pString = pString + userName + " : " + getVar(msg, "players")[i][1] + " (" + getVar(msg, "players")[i][3].power + "/" + getVar(msg, "players")[i][3].ten + "/" + getVar(msg, "players")[i][3].neg + ") [" + getPpgForId(msg, getVar(msg, "players")[i][0]) + " PP20TUH]\n";
  			}
  		}
  		pString = pString + "\n";
  	}

  	pString = pString + "**Individual**\n";

  	for(i = 0; i < getVar(msg, "players").length; i++) {
  		if(getVar(msg, "players")[i][3].team == "") {
			var userName = msg.guild.members.cache.get(getVar(msg, "players")[i][0]).nickname;
			if(userName == null) {
				userName = client.users.cache.get(getVar(msg, "players")[i][0]).username;
			}
	  		pString = pString + userName + " : " + getVar(msg, "players")[i][1] + " (" + getVar(msg, "players")[i][3].power + "/" + getVar(msg, "players")[i][3].ten + "/" + getVar(msg, "players")[i][3].neg + ") [" + getPpgForId(msg, getVar(msg, "players")[i][0]) + " PP20TUH]\n";
  		}
  	}

  		var tuNum = getVar(msg, "readingTu");

  	  const embed = new Discord.MessageEmbed()
		.setColor('#00ff00')
		.setTitle('Final Score')
		.setDescription('Tossups played: ' + tuNum)
		.addField('Team scores and individual scores', pString, false)
  	msg.channel.send(embed);
  	addEvent(msg, msg.author.username + " ended the game", msg.createdTimestamp, ["\n\n\n" + pString])
  	uploadEvents(msg);
  	msg.guild.members.cache.get(client.user.id).voice.channel.leave();


	playersCurrentlyInGame = playersCurrentlyInGame - getVar(msg, "players").length;
  	setVar(msg, "players", []);
  	setVar(msg, "category_list", []);
  	setVar(msg, "difficultyList", []);
}


const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))
async function readTossups(msg, channel, connection) {
	var i=-1;
	while (getVar(msg, "gameBeingPlayed")) {

		if(i != getVar(msg, "readingTu")) {


			if(getVar(msg, "readingUntilTu") != -1) {
				if(getVar(msg,"readingTu") >= getVar(msg, "readingUntilTu")) {
					endGame(msg);
					return;
				}
			}

			if(getVar(msg, "botVoiceConnection").channel.members.array().length <= 1) {
		  	 	 const embed = new Discord.MessageEmbed()
				.setColor('#ff0000')
				.setTitle('Inactivity')
				.setDescription("All players have left the voice channel. Stopping reading.")
				msg.channel.send(embed).then(m => endGame(m))
				return;
			}

			if(getVar(msg, "players").length <= 0) {

		  	  const embed = new Discord.MessageEmbed()
				.setColor('#ff0000')
				.setTitle('Inactivity')
				.setDescription("All players have left the game. Stopping reading.")
				msg.channel.send(embed);
				setVar(msg, "gameBeingPlayed", false)
  				getVar(msg, "botVoiceConnection").play("./pause.mp3");
  				msg.guild.members.cache.get(client.user.id).voice.channel.leave();
  				setVar(msg, "category_list", []);
  				setVar(msg, "difficultyList", []);
				return;
			}


			clearBuzzes(msg);
			i = getVar(msg, "readingTu");
			while (!compliesWithDifficulty(getVar(msg, "tossups")[i].tournament_id, getVar(msg, "difficultyList"))) {
				var newTossupsList = getVar(msg, "tossups");
				newTossupsList.splice(i, 1); 
				setVar(msg, "tossups", newTossupsList);
			}



			setVar(msg, "curAnswer", getVar(msg, "tossups")[i]["formatted_answer"]);//.substring(0, tossups[i]["formatted_answer"].lastIndexOf("&lt"))
			setVar(msg, "canPowerThisTossup", 1);
			if(getVar(msg, "tossups")[i]["text"].lastIndexOf("*") == -1) {
				setVar(msg, "canPowerThisTossup", 0);
			} 

			channel.send("TU " + (i+1) + ":").then(message => {




				var tuText = getVar(msg, "tossups")[i]["text"]
				.replace(/( .)\./gi, "$1")
				.replace(/[0-9]+\./, "")
				.replace(/St\./gi, "Saint")
				.replace(/Mr\./gi, "Mr")
				.replace(/Mrs\./gi, "Mrs")
				.replace(/Ms\./gi, "Ms")
				.replace(/vs\./gi, "versus")
				.replace(/Dr\./gi, "Doctor")

				readTu(msg, getVar(msg, "botVoiceConnection"), tuText.split("*"), 0, 0, message)
			});

			
		}
		await sleep(2000);
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

	for(var ti = 0; ti < Object.keys(getVar(msg, "teams")).length; ti++) {
  		var team = Object.keys(getVar(msg, "teams"))[ti];
  		getVar(msg, "teams")[team].buzzed = false;
  	}

}

function judgeAnswer(msg) {

	answers = getUnderlined(getVar(msg, "curAnswer"), [])

	for(i = 0; i < answers.length; i++) {
		if(msg.content.toLowerCase() == answers[i].toLowerCase()) {
			return true;
		}
	}

	
	if(stringSimilarity.compareTwoStrings(getVar(msg, "curAnswer").toLowerCase(), msg.content.toLowerCase()) > 0.666) {return true;}

	
	if(stringSimilarity.compareTwoStrings(getVar(msg, "curAnswer").toLowerCase().substring(0, msg.content.toLowerCase().length), msg.content.toLowerCase()) > 0.75) {return true;}
	return false;
}

function judgeBonus(textGiven, answerText) {

	answers = getUnderlined(answerText, [])

	for(i = 0; i < answers.length; i++) {
		if(textGiven.toLowerCase() == answers[i].toLowerCase()) {
			return true;
		}
	}

	
	if(stringSimilarity.compareTwoStrings(answerText.toLowerCase(), textGiven.toLowerCase()) > 0.666) {return true;}

	
	if(stringSimilarity.compareTwoStrings(answerText.toLowerCase().substring(0, textGiven.toLowerCase().length), textGiven.toLowerCase()) > 0.75) {return true;}
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

function addEvent(msg, eventName, eventTimeStamp, dataLines) {
	var newEventList = getVar(msg, "events")
	newEventList.push(createEvent(eventName, dataLines, eventTimeStamp))
	setVar(msg, "events", newEventList);
}

function uploadEvents(msg) {

	var events = getVar(msg, "events");

	var text = "PopBot " + version + "\n\nAuthor: Michael Karpov\nServer ID: " + msg.guild.id + "\n------------------------------------------\n\n";
	console.log(events.length)

  	for(var i=0;i<getVar(msg, "events").length;i++) {
		var event = getVar(msg, "events")[i];

		const d = new Date( event.timestamp );
		date = d.getHours() + ":" + d.getMinutes() + ", " + d.toDateString();

		text = text + event.eventName + " -- " + date + "\n";
		for(var j = 0; j < event.lines.length; j++) {
			text = text + event.lines[j] + "\n"
		}
		text = text + "\n\n"
  	}

	for(var i = 0; i < events.legth; i++) {
		console.log(i)		

	}

	gistClient.setToken(gist_token).create({
	    "files": {
	        "Game_Log.txt": {
	            "content": text
	        }
	    },
	    "description": "A game log created by PopBot.",
	    "public": true
	}).then(newGist => {
		const partTwoEmbed = new Discord.MessageEmbed()
			.setColor('#ffff00')
			.setTitle('Game log')
			.setDescription(newGist.html_url)

		msg.channel.send(partTwoEmbed);
	})




}

function isInCategorylist(msg, categoryID) {
	for(var i = 0; i < getVar(msg, "category_list").length; i++) {
		if(getVar(msg, "category_list")[i] == categoryID) {
			return true;
		}
	}
	return false;
}


function categoryFullyInCategoryList(msg, cat_id) {
	var subcatCompare = getSubcategoriesForCategory(cat_id);
	var func = []
	for(var i = 0; i < getVar(msg, "category_list").length; i++) {
		if(cat_id == getSubcategoryCatIDbyID(getVar(msg, "category_list")[i])) {
			func.push(getVar(msg, "category_list")[i]);
		}
	}
	console.log(subcatCompare)
	return areArraysEqualSets(func, subcatCompare);
}

function areArraysEqualSets(a1, a2) {
  const superSet = {};
  for (const i of a1) {
    const e = i + typeof i;
    superSet[e] = 1;
  }

  for (const i of a2) {
    const e = i + typeof i;
    if (!superSet[e]) {
      return false;
    }
    superSet[e] = 2;
  }

  for (let e in superSet) {
    if (superSet[e] === 1) {
      return false;
    }
  }

  return true;
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

function getTeamNameForId(msg, id) {
	for(var i = 0; i < getVar(msg, "players").length; i++) {
		if(getVar(msg, "players")[i][0] == id) {
			return getVar(msg, "players")[i][3].team
		}
	}
	return "";
}

function getTournamentName(id) {
	for(var i = 0; i < tournament_mapping.length; i++) {
		if(tournament_mapping[i].id == id) {
			return tournament_mapping[i].name
		}
	}

	return "Tournament not found";
}

function getSubcategoriesForCategory(cat_id) {
	var func_return = []
	for(var i = 0; i < subcategory_mapping.length; i++) {
		if(subcategory_mapping[i].category_id == cat_id) {
			func_return.push(subcategory_mapping[i].id);
		}
	}

	return func_return;
}

function getSubcategoryCatIDbyID(subcat_id) {
	for(var i = 0; i < subcategory_mapping.length; i++) {
		if(subcategory_mapping[i].id == subcat_id) {
			return subcategory_mapping[i].category_id;
		}
	}

	return null;
}

function getSubcatIDByName(cat, str) {
	for(var i = 0; i < subcategory_mapping.length; i++) {
		if(subcategory_mapping[i].name.toLowerCase() == cat.toLowerCase() + " " + str.toLowerCase()) {
			return subcategory_mapping[i].id
		}
	}

	return null;
}

function getSubcatNameById(id) {
	for(var i = 0; i < subcategory_mapping.length; i++) {
		if(subcategory_mapping[i].id == id) {
			return subcategory_mapping[i].name
		}
	}

	return null;
}

function getCatIdByName(str) {
	for(var i = 0; i < category_mapping.length; i++) {
		if(category_mapping[i].name.toLowerCase() == str.toLowerCase()) {
			return category_mapping[i].id
		}
	}

	return null;
}

function getCatNamebyID(id) {
	for(var i = 0; i < category_mapping.length; i++) {
		if(category_mapping[i].id == id) {
			return category_mapping[i].name
		}
	}

	return null;
}

function categoryExists(name) {
	return getCatIdByName(name) != null
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

function getPpgForId(msg, user_id) {
	var div = 1
	if(getVar(msg, "readingTu") > 0) {
		div = getVar(msg, "readingTu")
	}
	for(var i = 0; i < getVar(msg, "players").length; i++) {
		if(user_id == getVar(msg, "players")[i][0]) {
			return ((20/div)*getVar(msg, "players")[i][1]).toFixed(2);
		}
	}

	return 0;
}

function getPpbForName(msg, name) {
	var div = 1;
	if(getVar(msg, "teams")[name].bonus.gotten > 0) {
		div = getVar(msg, "teams")[name].bonus.gotten
	}
	return (getVar(msg, "teams")[name].bonus.points/div).toFixed(2);
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

var onlineMessages = ["/help", "Reading for " + playersCurrentlyInGame + " player(s)", version, "Online for " + formatTime(uptimeSeconds), "Live in " + client.guilds.cache.size + " servers"]
function getOnlineMessage(index) {
	onlineMessages = ["/help", "Reading for " + playersCurrentlyInGame + " player(s)", version, "Online for " + formatTime(uptimeSeconds), "Live in " + client.guilds.cache.size + " servers"]
	return onlineMessages[index];
}

function getRandom(arr, n) {
    var result = new Array(n),
        len = arr.length,
        taken = new Array(len);
    if (n > len)
        throw new RangeError("getRandom: more elements taken than available");
    while (n--) {
        var x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}

function getPublicPresets() {
	  	var public = "";
	  	var itemsToGet = 5;
	  	if(Object.keys(public_presets).length < 5) {
	  		itemsToGet = Object.keys(public_presets).length;
	  	}
	  	var rand = getRandom(Object.keys(public_presets), itemsToGet)
  		for(var i = 0; i < rand.length; i++) {
  			var name = rand[i]
  			var preset = public_presets[name];
  			public = public + "__**" + name + "**__\n"

	   		var cats = "__Categories__\n"
			var newCategoryList = preset.cats;
			for(var j = 0; j < newCategoryList.length; j++) {
				if(j > 5) {
					cats = cats + "  [...]\n";
					break;
				}
				cats = cats + getSubcatNameById(newCategoryList[j]) + ", ";
			}
			
	   		var diff = "__Difficulty__\n"
			var newCategoryList = preset.diff;
			for(var j = 0; j < newCategoryList.length; j++) {
				if(j > 5) {
					diff = diff + "  [...]\n";
					break;
				}
				diff = diff + newCategoryList[j] + ", ";
			}
			public = public + cats + "\n" + diff + "\n\n";
  		}

  		return public;
}


async function rotateOnlineMessage(index) {
	client.user.setActivity(getOnlineMessage(index-1), {
		type: "WATCHING"
	});
	await sleep(5000)
	index = index % (onlineMessages.length);
	rotateOnlineMessage(index+1);
}


function readPart2Bonus(msg, bonus, score, prevPartEmbed) {
			console.log("p2 -- " + score)
			const filter = m => {
				if(m.author.id == msg.author.id && m.content.toUpperCase() == m.content) {return true;}
				for(var bi = 0; bi < getVar(msg, "players").length; bi++) {
					if(getVar(msg, "players")[bi][0] == msg.author.id) {
						if(getVar(msg, "players")[bi][3].team == "") {
							return (m.author.id == msg.author.id && m.content.toUpperCase() == m.content);
						} else {
							for(var ai = 0; ai < getVar(msg, "players").length; ai++) {
								if(getVar(msg, "players")[ai][0] == m.author.id) {
									return (getVar(msg, "players")[bi][3].team == getVar(msg, "players")[ai][3].team && m.content.toUpperCase() == m.content)
								}
							}
						}
					}
				}
				return false;
			};
			

				var bonusAnswered = false;

		  		const partTwoEmbed = new Discord.MessageEmbed()
				.setColor('#ffffff')
				.setTitle('Part 2')
				.setDescription(bonus.part2.text)

				prevPartEmbed.channel.send(partTwoEmbed).then(p2msg => {
					const collector = p2msg.channel.createMessageCollector(filter, { time: getVar(msg, "bonusTime") });

					collector.on('collect', m => {
						if(!bonusAnswered && getVar(msg, "gameBeingPlayed")) {
							bonusAnswered = true;
							if(judgeBonus(m.content, bonus.part2.answer)) {
						  		const partTwoAnswerEmbed = new Discord.MessageEmbed()
								.setColor('#00ff00')
								.setTitle('Correct')
								.setDescription("**+10** pts")
								.addField("Answerline", bonus.part2.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
								.addField("Answer given", m.content)

								p2msg.channel.send(partTwoAnswerEmbed).then(p2Embed => {
									p2Embed.react("❌");
									const filterN = (reaction, user) => {
										return reaction.emoji.name === '❌' && user.bot == false;
									};

									p2Embed.awaitReactions(filterN, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
									.then(collected => {
										const NEWpartTwoAnswerEmbed = new Discord.MessageEmbed()
										.setColor('#ff0000')
										.setTitle('Incorrect')
										.setDescription("0 pts")
										.addField("Answerline", bonus.part2.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
										.addField("Answer given", m.content)

										p2Embed.edit(NEWpartTwoAnswerEmbed);
										if(getVar(msg, "gameBeingPlayed")) {
											readPart3Bonus(msg, bonus, score + 0, p2Embed);
										}
									})
									.catch(collected => {
										if(getVar(msg, "gameBeingPlayed")) {
											readPart3Bonus(msg, bonus, score + 10, p2Embed);
										}
									})
								})
							} else {
						  		const partTwoAnswerEmbed = new Discord.MessageEmbed()
								.setColor('#ff0000')
								.setTitle('Incorrect')
								.addField("Answerline", bonus.part2.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
								.addField("Answer given", m.content)

								p2msg.channel.send(partTwoAnswerEmbed).then(p2Embed => {
									p2Embed.react("✅");
									const filterN = (reaction, user) => {
										return reaction.emoji.name === '✅' && user.bot == false;
									};

									p2Embed.awaitReactions(filterN, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
									.then(collected => {
										const NEWpartTwoAnswerEmbed = new Discord.MessageEmbed()
										.setColor('#00ff00')
										.setTitle('Correct')
										.setDescription("**+10** pts")
										.addField("Answerline", bonus.part2.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
										.addField("Answer given", m.content)

										p2Embed.edit(NEWpartTwoAnswerEmbed);
										if(getVar(msg, "gameBeingPlayed")) {
											readPart3Bonus(msg, bonus, score + 10, p2Embed);
										}
									})
									.catch(collected => {
										if(getVar(msg, "gameBeingPlayed")) {
											readPart3Bonus(msg, bonus, score + 0, p2Embed);
										}
									})
								})
							}
						}
					});



					collector.on('end', collected => {
						if(!bonusAnswered && getVar(msg, "gameBeingPlayed")) {
							const NEWpartOneAnswerEmbed = new Discord.MessageEmbed()
							.setColor('#ff0000')
							.setTitle('Time\'s up')
							.setDescription("0 pts")
							.addField("Answerline", bonus.part2.answer.split("<strong>").join("__**").split("</strong>").join("**__"))

							prevPartEmbed.channel.send(NEWpartOneAnswerEmbed);
							if(getVar(msg, "gameBeingPlayed")) {
								readPart3Bonus(msg, bonus, score, msg);
							}
						}
					});
				})
			
}

function handleBuzz(msg, buzzer_id) {
 	var thisPlayerBuzzed = false;

	for(var i=0;i<getVar(msg, "players").length;i++) {
		if(getVar(msg, "players")[i][3].team == "") {
			if(getVar(msg, "players")[i][0] == buzzer_id && getVar(msg, "players")[i][2]) {
				thisPlayerBuzzed = true;
			}
		} else {
			if(getVar(msg, "players")[i][0] == buzzer_id && (getVar(msg, "players")[i][2] || getVar(msg, "teams")[getVar(msg, "players")[i][3].team].buzzed) ) {
				thisPlayerBuzzed = true;
			}
		}

	}





  	if(msg.guild.members.cache.get(client.user.id).voice.channel == msg.member.voice.channel && msg.guild.members.cache.get(client.user.id).voice.channel !== null) {
  		if(!thisPlayerBuzzed || getVar(msg, "allowBuzzMultipleTimes")) {
		  	var joined=false;
		  	if(getVar(msg, "canBuzz") && !getVar(msg, "isPaused")) {
			  	for(i=0;i<getVar(msg, "players").length;i++) {
			  		if(getVar(msg, "players")[i][0] == buzzer_id) {

						if(getVar(msg, "players")[i][3].team != "") {
							var newTeamList = getVar(msg, "teams");
							newTeamList[getVar(msg, "players")[i][3].team].buzzed = true;
							setVar(msg, "teams", newTeamList)
						}

			  			getVar(msg, "players")[i][2] = true;
			  			joined=true;		  		
			  			setVar(msg, "canBuzz", false);
			  			msg.channel.send("<@" + buzzer_id + "> has buzzed! :bulb:").then(message => {
			  				addEvent(msg, msg.author.username + " buzzed on tossup " + (getVar(msg, "readingTu")+1), message.createdTimestamp, [])
				  			setVar(msg, "buzz", buzzer_id);
				  			getVar(msg, "botVoiceConnection").play("./buzz.mp3");
				  			setVar(msg, "timeOut", true)
				  			var currentBuzz = buzzer_id;
				  			var timeout = setTimeout(function(){ 
				  				message.delete();
				  				if(getVar(msg, "timeOut") == true && currentBuzz == getVar(msg, "buzz").id) {
									msg.channel.send(":x: Time is up. **-5** points").then(timeoutMessage => {
										addEvent(msg, msg.author.username + " was timed out of the tossup.", timeoutMessage.createdTimestamp, [])
									})

									setVar(msg, "canBuzz", true)
									for(i=0;i<getVar(msg, "players").length;i++) {
										if(getVar(msg, "players")[i][0] == buzzer_id) {
											var newPlayerList = getVar(msg, "players");
										  	newPlayerList[i][1] = newPlayerList[i][1] - 5;
											newPlayerList[i][3].neg = newPlayerList[i][3].neg + 1
										  	setVar(msg, "players", newPlayerList)
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
										.setFooter(getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round)
										getVar(msg, "curBM").channel.send(embed).then(timeoutMessage => {
											addEvent(msg, "tossup " + (getVar(msg, "readingTu")+1) + " went dead.", timeoutMessage.createdTimestamp, ["	-- Text: " + getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"], "	-- Answer: " + getVar(msg, "curAnswer"), "	-- INFO: " + getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round]);
										})

										getVar(msg, "curBM").edit(getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"]);
										setVar(msg, "currentTuCanTimeout", false)
										setVar(msg, "readingTu", getVar(msg, "readingTu") + 1)
									}
									setVar(msg, "canBuzz", true);
									setVar(msg, "buzz", null);
									clearTimeout(getVar(msg, "timeoutTimer"))
				  				}
				  				//msg.delete();
				  			 }, getVar(msg, "buzzTime") * (1 + getPlayer(msg, buzzer_id)[3].mobile));
				  			setVar(msg, "timeoutTimer", timeout)
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

function readPart3Bonus(msg, bonus, score, prevPartEmbed) {
	console.log("p3 -- " + score)
			const filter = m => {
				if(m.author.id == msg.author.id && m.content.toUpperCase() == m.content) {return true;}
				for(var bi = 0; bi < getVar(msg, "players").length; bi++) {
					if(getVar(msg, "players")[bi][0] == msg.author.id) {
						if(getVar(msg, "players")[bi][3].team == "") {
							return (m.author.id == msg.author.id && m.content.toUpperCase() == m.content);
						} else {
							for(var ai = 0; ai < getVar(msg, "players").length; ai++) {
								if(getVar(msg, "players")[ai][0] == m.author.id) {
									return (getVar(msg, "players")[bi][3].team == getVar(msg, "players")[ai][3].team && m.content.toUpperCase() == m.content)
								}
							}
						}
					}
				}
				return false;
			};
			

				var bonusAnswered = false;

		  		const partTwoEmbed = new Discord.MessageEmbed()
				.setColor('#ffffff')
				.setTitle('Part 3')
				.setDescription(bonus.part3.text)

				prevPartEmbed.channel.send(partTwoEmbed).then(p2msg => {
					const collector = p2msg.channel.createMessageCollector(filter, { time: getVar(msg, "bonusTime") });

					collector.on('collect', m => {

						if(!bonusAnswered && getVar(msg, "gameBeingPlayed")) {
							bonusAnswered = true;
							if(judgeBonus(m.content, bonus.part3.answer)) {
						  		const partTwoAnswerEmbed = new Discord.MessageEmbed()
								.setColor('#00ff00')
								.setTitle('Correct')
								.setDescription("**+10** pts")
								.addField("Answerline", bonus.part3.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
								.addField("Answer given", m.content)

								p2msg.channel.send(partTwoAnswerEmbed).then(p2Embed => {
									p2Embed.react("❌");
									const filterN = (reaction, user) => {
										return reaction.emoji.name === '❌' && user.bot == false;
									};

									p2Embed.awaitReactions(filterN, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
									.then(collected => {
										const NEWpartTwoAnswerEmbed = new Discord.MessageEmbed()
										.setColor('#ff0000')
										.setTitle('Incorrect')
										.setDescription("0 pts")
										.addField("Answerline", bonus.part3.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
										.addField("Answer given", m.content)

										p2Embed.edit(NEWpartTwoAnswerEmbed);

										const finalEmbed = new Discord.MessageEmbed()
										.setColor('#0000ff')
										.setTitle('Bonus')
										.setDescription((score+0) + " points on the bonus.")
										.setFooter(bonus.tournament_name + " // rd: " + bonus.round)
										p2Embed.channel.send(finalEmbed)
										for(var i=0;i<getVar(msg, "players").length;i++) {
											if(getVar(msg, "players")[i][0] == msg.author.id) {
												if(getVar(msg, "players")[i][3].team != "") {
													var newTeamsList = getVar(msg, "teams");
													newTeamsList[getVar(msg, "players")[i][3].team].score = newTeamsList[getVar(msg, "players")[i][3].team].score + (score);
													newTeamsList[getVar(msg, "players")[i][3].team].bonus.gotten = newTeamsList[getVar(msg, "players")[i][3].team].bonus.gotten + 1;
													newTeamsList[getVar(msg, "players")[i][3].team].bonus.points = newTeamsList[getVar(msg, "players")[i][3].team].bonus.points + score;
													addEvent(msg, "Team '" + getVar(msg, "players")[i][3].team + "' got " + (score) + " points on their bonus for tossup " + (getVar(msg, "readingTu")+1), p2msg.createdTimestamp, ["	-- Part 1 : " + bonus.part1.text, "		Answer: " + bonus.part1.answer, "	-- Part 2 : " + bonus.part2.text, "		Answer: " + bonus.part2.answer, "	-- Part 3 : " + bonus.part3.text, "		Answer: " + bonus.part3.answer])
													setVar(msg, "teams", newTeamsList)
												}
											}
										}
										setVar(msg, "readingTu", getVar(msg, "readingTu") + 1);
										setVar(msg, "canBuzz", true);
									})
									.catch(collected => {
										const finalEmbed = new Discord.MessageEmbed()
										.setColor('#0000ff')
										.setTitle('Bonus')
										.setDescription((score+10) + " points on the bonus.")
										.setFooter(bonus.tournament_name + " // rd: " + bonus.round)
										p2Embed.channel.send(finalEmbed)
										for(var i=0;i<getVar(msg, "players").length;i++) {
											if(getVar(msg, "players")[i][0] == msg.author.id) {
												if(getVar(msg, "players")[i][3].team != "") {
													var newTeamsList = getVar(msg, "teams");
													newTeamsList[getVar(msg, "players")[i][3].team].score = newTeamsList[getVar(msg, "players")[i][3].team].score + (score+10);
													newTeamsList[getVar(msg, "players")[i][3].team].bonus.gotten = newTeamsList[getVar(msg, "players")[i][3].team].bonus.gotten + 1;
													newTeamsList[getVar(msg, "players")[i][3].team].bonus.points = newTeamsList[getVar(msg, "players")[i][3].team].bonus.points + (score+10);
													addEvent(msg, "Team '" + getVar(msg, "players")[i][3].team + "' got " + (score+10) + " points on their bonus for tossup " + (getVar(msg, "readingTu")+1), p2msg.createdTimestamp, ["	-- Part 1 : " + bonus.part1.text, "		Answer: " + bonus.part1.answer, "	-- Part 2 : " + bonus.part2.text, "		Answer: " + bonus.part2.answer, "	-- Part 3 : " + bonus.part3.text, "		Answer: " + bonus.part3.answer])
													setVar(msg, "teams", newTeamsList)
												}
											}
										}
										setVar(msg, "readingTu", getVar(msg, "readingTu") + 1);
										setVar(msg, "canBuzz", true);
									})
								})
							} else {
						  		const partTwoAnswerEmbed = new Discord.MessageEmbed()
								.setColor('#ff0000')
								.setTitle('Incorrect')
								.addField("Answerline", bonus.part3.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
								.addField("Answer given", m.content)

								p2msg.channel.send(partTwoAnswerEmbed).then(p2Embed => {
									p2Embed.react("✅");
									const filterN = (reaction, user) => {
										return reaction.emoji.name === '✅' && user.bot == false;
									};

									p2Embed.awaitReactions(filterN, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
									.then(collected => {
										const NEWpartTwoAnswerEmbed = new Discord.MessageEmbed()
										.setColor('#00ff00')
										.setTitle('Correct')
										.setDescription("**+10** pts")
										.addField("Answerline", bonus.part3.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
										.addField("Answer given", m.content)

										p2Embed.edit(NEWpartTwoAnswerEmbed);
										const finalEmbed = new Discord.MessageEmbed()
										.setColor('#0000ff')
										.setTitle('Bonus')
										.setDescription((score+10) + " points on the bonus.")
										.setFooter(bonus.tournament_name + " // " + bonus.round)
										p2Embed.channel.send(finalEmbed)
										for(var i=0;i<getVar(msg, "players").length;i++) {
											if(getVar(msg, "players")[i][0] == msg.author.id) {
												if(getVar(msg, "players")[i][3].team != "") {
													var newTeamsList = getVar(msg, "teams");
													newTeamsList[getVar(msg, "players")[i][3].team].score = newTeamsList[getVar(msg, "players")[i][3].team].score + (score+10);
													newTeamsList[getVar(msg, "players")[i][3].team].bonus.gotten = newTeamsList[getVar(msg, "players")[i][3].team].bonus.gotten + 1;
													newTeamsList[getVar(msg, "players")[i][3].team].bonus.points = newTeamsList[getVar(msg, "players")[i][3].team].bonus.points + (score+10);
													addEvent(msg, "Team '" + getVar(msg, "players")[i][3].team + "' got " + (score+10) + " points on their bonus for tossup " + (getVar(msg, "readingTu")+1), p2msg.createdTimestamp, ["	-- Part 1 : " + bonus.part1.text, "		Answer: " + bonus.part1.answer, "	-- Part 2 : " + bonus.part2.text, "		Answer: " + bonus.part2.answer, "	-- Part 3 : " + bonus.part3.text, "		Answer: " + bonus.part3.answer])
													setVar(msg, "teams", newTeamsList)
												}
											}
										}
										setVar(msg, "readingTu", getVar(msg, "readingTu") + 1);
										setVar(msg, "canBuzz", true);
									})
									.catch(collected => {
										const finalEmbed = new Discord.MessageEmbed()
										.setColor('#0000ff')
										.setTitle('Bonus')
										.setDescription((score+0) + " points on the bonus.")
										.setFooter(bonus.tournament_name + " // rd: " + bonus.round)
										p2Embed.channel.send(finalEmbed)
										for(var i=0;i<getVar(msg, "players").length;i++) {
											if(getVar(msg, "players")[i][0] == msg.author.id) {
												if(getVar(msg, "players")[i][3].team != "") {
													var newTeamsList = getVar(msg, "teams");
													newTeamsList[getVar(msg, "players")[i][3].team].score = newTeamsList[getVar(msg, "players")[i][3].team].score + (score);
													newTeamsList[getVar(msg, "players")[i][3].team].bonus.gotten = newTeamsList[getVar(msg, "players")[i][3].team].bonus.gotten + 1;
													newTeamsList[getVar(msg, "players")[i][3].team].bonus.points = newTeamsList[getVar(msg, "players")[i][3].team].bonus.points + score;
													addEvent(msg, "Team '" + getVar(msg, "players")[i][3].team + "' got " + score + " points on their bonus for tossup " + (getVar(msg, "readingTu")+1), p2msg.createdTimestamp, ["	-- Part 1 : " + bonus.part1.text, "		Answer: " + bonus.part1.answer, "	-- Part 2 : " + bonus.part2.text, "		Answer: " + bonus.part2.answer, "	-- Part 3 : " + bonus.part3.text, "		Answer: " + bonus.part3.answer])
													setVar(msg, "teams", newTeamsList)
												}
											}
										}
										setVar(msg, "readingTu", getVar(msg, "readingTu") + 1);
										setVar(msg, "canBuzz", true);
									})
								})
							}
						}
					});



					collector.on('end', collected => {

						if(!bonusAnswered && getVar(msg, "gameBeingPlayed")) {

							const NEWpartOneAnswerEmbed = new Discord.MessageEmbed()
							.setColor('#ff0000')
							.setTitle('Time\'s up')
							.setDescription("0 pts")
							.addField("Answerline", bonus.part3.answer.split("<strong>").join("__**").split("</strong>").join("**__"))

							prevPartEmbed.channel.send(NEWpartOneAnswerEmbed);

							const finalEmbed = new Discord.MessageEmbed()
							.setColor('#0000ff')
							.setTitle('Bonus')
							.setDescription((score+0) + " points on the bonus.")
							.setFooter(bonus.tournament_name + " // rd: " + bonus.round)
							prevPartEmbed.channel.send(finalEmbed)
							for(var i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									if(getVar(msg, "players")[i][3].team != "") {
										var newTeamsList = getVar(msg, "teams");
										newTeamsList[getVar(msg, "players")[i][3].team].score = newTeamsList[getVar(msg, "players")[i][3].team].score + (score);
										addEvent(msg, "Team '" + getVar(msg, "players")[i][3].team + "' got " + score + " points on their bonus for tossup " + (getVar(msg, "readingTu")+1), p2msg.createdTimestamp, ["	-- Part 1 : " + bonus.part1.text, "		Answer: " + bonus.part1.answer, "	-- Part 2 : " + bonus.part2.text, "		Answer: " + bonus.part2.answer, "	-- Part 3 : " + bonus.part3.text, "		Answer: " + bonus.part3.answer])
										setVar(msg, "teams", newTeamsList)
									}
								}
							}
							setVar(msg, "readingTu", getVar(msg, "readingTu") + 1);
							setVar(msg, "canBuzz", true);
						}
					});
				})
			
}


async function readBonus(msg) {
	var userid = msg.author.id;
	var bonus = {"leadin":"", "tournament_name": "", "round":"", "part1": {"text": "", "answer": ""}, "part2": {"text": "", "answer": ""}, "part3": {"text": "", "answer": ""}}

	var category_query = getVar(msg, "category_list").join(" OR subcategory_id = ");
	pool.query("SELECT * FROM bonuses WHERE subcategory_id = " + category_query, (err, res) => {
		setVar(msg, "bonuses", shuffle(res.rows));
		
		while (!compliesWithDifficulty(getVar(msg, "bonuses")[0].tournament_id, getVar(msg, "difficultyList"))) {
			var newTossupsList = getVar(msg, "bonuses");
			newTossupsList.splice(0, 1); 
			setVar(msg, "bonuses", newTossupsList);
		}
		
		pool.query("SELECT * FROM bonus_parts WHERE bonus_id = " + getVar(msg, "bonuses")[0].id, (err, resN) => {
			bonus.leadin = getVar(msg, "bonuses")[0].leadin;
			bonus.tournament_name = getTournamentName(getVar(msg, "bonuses")[0].tournament_id);
			bonus.round = getVar(msg, "bonuses")[0].round;
			for(var j = 0; j < resN.rows.length; j++) {
				var bPart = resN.rows[j];
				bonus["part" + bPart.number].text = bPart.text;
				bonus["part" + bPart.number].answer = bPart.formatted_answer;
			}

			const filter = m => {
				if(m.author.id == msg.author.id && m.content.toUpperCase() == m.content) {return true;}
				for(var bi = 0; bi < getVar(msg, "players").length; bi++) {
					if(getVar(msg, "players")[bi][0] == msg.author.id) {
						if(getVar(msg, "players")[bi][3].team == "") {
							return (m.author.id == msg.author.id && m.content.toUpperCase() == m.content);
						} else {
							for(var ai = 0; ai < getVar(msg, "players").length; ai++) {
								if(getVar(msg, "players")[ai][0] == m.author.id) {
									return (getVar(msg, "players")[bi][3].team == getVar(msg, "players")[ai][3].team && m.content.toUpperCase() == m.content)
								}
							}
						}
					}
				}
				return false;
			};
			
		  	const leadinEmbed = new Discord.MessageEmbed()
				.setColor('#ffffff')
				.setTitle('Bonus for "' + getTeamNameForId(msg, msg.author.id) + '"')
				.setDescription(bonus.leadin)

			var bonusAnswered = false;

			msg.channel.send(leadinEmbed).then(leadinMsg => {

		  		const partOneEmbed = new Discord.MessageEmbed()
				.setColor('#ffffff')
				.setTitle('Part 1')
				.setDescription(bonus.part1.text)

				leadinMsg.channel.send(partOneEmbed).then(p1msg => {
					const collector = p1msg.channel.createMessageCollector(filter, { time: getVar(msg, "bonusTime") });

					collector.on('collect', m => {
						if(!bonusAnswered && getVar(msg, "gameBeingPlayed")) {
							bonusAnswered = true;
							if(judgeBonus(m.content, bonus.part1.answer)) {
						  		const partOneAnswerEmbed = new Discord.MessageEmbed()
								.setColor('#00ff00')
								.setTitle('Correct')
								.setDescription("**+10** pts")
								.addField("Answerline", bonus.part1.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
								.addField("Answer given", m.content)

								p1msg.channel.send(partOneAnswerEmbed).then(p1Embed => {
									p1Embed.react("❌");
									const filterN = (reaction, user) => {
										return reaction.emoji.name === '❌' && user.bot == false;
									};

									p1Embed.awaitReactions(filterN, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
									.then(collected => {
										const NEWpartOneAnswerEmbed = new Discord.MessageEmbed()
										.setColor('#ff0000')
										.setTitle('Incorrect')
										.setDescription("0 pts")
										.addField("Answerline", bonus.part1.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
										.addField("Answer given", m.content)

										p1Embed.edit(NEWpartOneAnswerEmbed);
										if(getVar(msg, "gameBeingPlayed")) {
											readPart2Bonus(msg, bonus, 0, p1Embed);
										}
									})
									.catch(collected => {
										if(getVar(msg, "gameBeingPlayed")) {
											readPart2Bonus(msg, bonus, 10, p1Embed);
										}
									})
								})
							} else {
						  		const partOneAnswerEmbed = new Discord.MessageEmbed()
								.setColor('#ff0000')
								.setTitle('Incorrect')
								.addField("Answerline", bonus.part1.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
								.addField("Answer given", m.content)

								p1msg.channel.send(partOneAnswerEmbed).then(p1Embed => {
									p1Embed.react("✅");
									const filterN = (reaction, user) => {
										return reaction.emoji.name === '✅' && user.bot == false;
									};

									p1Embed.awaitReactions(filterN, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
									.then(collected => {
										const NEWpartOneAnswerEmbed = new Discord.MessageEmbed()
										.setColor('#00ff00')
										.setTitle('Correct')
										.setDescription("**+10** pts")
										.addField("Answerline", bonus.part1.answer.split("<strong>").join("__**").split("</strong>").join("**__"))
										.addField("Answer given", m.content)

										p1Embed.edit(NEWpartOneAnswerEmbed);
										if(getVar(msg, "gameBeingPlayed")) {
											readPart2Bonus(msg, bonus, 10, p1Embed);
										}
									})
									.catch(collected => {
										if(getVar(msg, "gameBeingPlayed")) {
											readPart2Bonus(msg, bonus, 0, p1Embed);
										}
									})
								})
							}
						}
					});



					collector.on('end', collected => {
						if(!bonusAnswered && getVar(msg, "gameBeingPlayed")) {
							const NEWpartOneAnswerEmbed = new Discord.MessageEmbed()
							.setColor('#ff0000')
							.setTitle('Time\'s up')
							.setDescription("0 pts")
							.addField("Answerline", bonus.part1.answer.split("<strong>").join("__**").split("</strong>").join("**__"))

							msg.channel.send(NEWpartOneAnswerEmbed);
							if(getVar(msg, "gameBeingPlayed")) {
								readPart2Bonus(msg, bonus, 0, msg);
							}
						}
					});
				})
			})


			
		})
		
	})
}



client.on('ready', () => {

  loadTournamentMapping();
  loadSubcatMapping();
  console.log('I am ready!');
  countUptime();
  rotateOnlineMessage(1);
  load();
});


function isAdmin(id) {
	return (id == 188031012444307457 || id == 691377361937104917) // Michael, Charles
}

// Create an event listener for messages
client.on('message', async msg => {
  // Voice only works in guilds, if the message does not come from a guild,
  // we ignore it
  if (!msg.guild) return;

  const args = msg.content.trim().split(' ');
  const command = args.shift().toLowerCase();

  if (typeof blacklist[msg.author.id] != "undefined") {
  	var plrCase = blacklist[msg.author.id];
  	if(plrCase.acknowledged == false) {
		const embed = new Discord.MessageEmbed()
		.setColor('#ff0000')
		.setTitle(':warning: BLACKLIST :warning:')
		.setDescription("Your usage of the bot has been reviewed and the developer has decided that your usage has been malicious, and thus has decided to permanently ban you from using the bot. After this message, the bot will not react to any of your commands.")
		.addField("REASON", plrCase.reason)
		.setFooter("User ID " + msg.author.id + " permanently banned.")
		blacklist[msg.author.id].acknowledged = true;


		fs.writeFile('blacklist.json', JSON.stringify(blacklist), (err) => {
		  if (err) throw err;
		  console.log('The file has been saved!');
		});

		msg.reply(embed)
	}
	return;
  }


  if(!varSetExists(msg)) {
  	console.log("Created gamedata set for " + msg.guild.id)
  	gameData[msg.guild.id] = createEmptyServerData();
  	setVar(msg, "readingTextChannel", msg.channel.id)
  }

  if(isTimedOut(msg, msg.author.id)) return;


  if(!msg.author.bot && (!(getVar(msg, "canTalk") || getVar(msg, "allowTalkingDuringGame")) || msg.content.startsWith(getVar(msg, "prefix")))) {
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
		  				addEvent(msg, msg.author.username + " got timed out for 5 seconds.", msg.createdTimestamp, [])
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




  if(command === "/blacklist") {
  	if(isAdmin(msg.author.id)) {
  		var user = args.shift().toLowerCase();
  		var reason_to_ban = args.join(" ");
  		blacklist[user] = {reason:reason_to_ban, acknowledged:false}
		const embed = new Discord.MessageEmbed()
		.setColor('#ff0000')
		.setTitle(':warning: BLACKLIST :warning:')
		.setDescription("Permanently banned user " + user)
		msg.reply(embed)

		fs.writeFile('blacklist.json', JSON.stringify(blacklist), (err) => {
		  if (err) throw err;
		  console.log('The file has been saved!');
		});

  	}
  }



  if (command === getVar(msg, "prefix") + "pause") {
  	if(!getVar(msg, "isPaused")) {
  		getVar(msg, "botVoiceConnection").play("./pause.mp3");
  		msg.channel.send(":pause_button: Game paused. use **/play** to continue.")
  		addEvent(msg, msg.author.username + " paused the game", msg.createdTimestamp, [])
  		setVar(msg, "isPaused", true)
  	}
  }


  if (command === getVar(msg, "prefix") + "stop" || command === getVar(msg, "prefix") + "end") {
  	endGame(msg)
  }

  if (command === "/guilddump") {
  	client.guilds.cache.forEach(m => {console.log(m.name)})
  }


  if (command === getVar(msg, "prefix") + "mobile") {
  	if(!getPlayer(msg, msg.author.id)) {
  		msg.reply("Join a game before changing your mobile mode status.");
  		return;
  	}

	const embed = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle('Mobile mode')
		.setDescription("This function is only avaliable to premium users. \n\n\n...Just kidding. Enabling mobile mode allows you to buzz by reacting with the :bulb: icon on the tossup being read, and gives you more time to answer on tossups.\nMobile mode enabled: " + getEmojiFor(getPlayer(msg, msg.author.id)[3].mobile) + "\n__React with the appropriate emoji below to enable/disable mobile mode.__")
  
	msg.channel.send(embed).then(message => {
		message.react("✅");
		message.react("❌");

		const filterYes = (reaction, user) => {
			return reaction.emoji.name === '✅' && user.id === msg.author.id;
		};

		const filterNo = (reaction, user) => {
			return reaction.emoji.name === '❌' && user.id === msg.author.id;
		};

		message.awaitReactions(filterYes, { max: 1, time: 10000, errors: ['time'] })
		.then(collected => {
			var newPlayerList = getVar(msg, "players");
			for(var i = 0; i < newPlayerList.length; i++) {
				if(newPlayerList[i][0] == msg.author.id) {
					newPlayerList[i][3].mobile = 1;
				}
			}
			setVar(msg, "players", newPlayerList)
		})

		message.awaitReactions(filterNo, { max: 1, time: 10000, errors: ['time'] })
		.then(collected => {
			var newPlayerList = getVar(msg, "players");
			for(var i = 0; i < newPlayerList.length; i++) {
				if(newPlayerList[i][0] == msg.author.id) {
					newPlayerList[i][3].mobile = 0;
				}
			}
			setVar(msg, "players", newPlayerList)
		})

	})
  }

  if (command === getVar(msg, "prefix") + "skip") {

  	if(!getVar(msg, "isPaused")) {
  		if(getVar(msg, "canBuzz")) {
	  		getVar(msg, "botVoiceConnection").play("./pause.mp3");
	  		setVar(msg, "readingTu", getVar(msg, "readingTu") + 1);
	  		addEvent(msg, msg.author.username + " skipped a tossup", msg.createdTimestamp, [])
  		} else {
  			msg.reply(" You can't skip right now.")
  		}
  	}
  }

  if (command === getVar(msg, "prefix") + "pk") {
  	var FACEText = "FACE";
  	var evert = "Everclue"
  	var pkbot = "PKBot"
  	var chest = "Chestnut"

  		// pkbot 741019043926114304
  		// chestnut 745454805954199683
  		// everclue 701922443740184637
  	
  	var botUsers = msg.guild.members.cache.filter(m => m.user.bot == true)
  	console.log(typeof botUsers.get("7428808129612351051"))
  	if(typeof botUsers.get("742880812961235105") != "undefined") {FACEText = "FACE - __This bot is already in this server!__ **(m help)**"}
  	if(typeof botUsers.get("701922443740184637") != "undefined") {evert = "Everclue - __This bot is already in this server!__ **(^help)**"}
  	if(typeof botUsers.get("741019043926114304") != "undefined") {pkbot = "PKBot - __This bot is already in this server!__ **(.help)**"}
  	if(typeof botUsers.get("745454805954199683") != "undefined") {chest = "Chestnut - __This bot is already in this server!__ **(+help)**"}
	

	const embed = new Discord.MessageEmbed()
			.setColor('#0000ff')
			.setTitle('Hi there!')
			.setDescription("Popbot is first and foremost a tossup reading bot, and although I do intend on adding functionality to read bonuses in team games, there are currently no plans to support PKs. \n\nInstead, consider checking out some bots specifically made for this!")
			.addField(FACEText, "FACE is a bot that can accelerate your card-making process, help you hold practices held by real moderators, and pk against other players.\nPricing - Free (Includes premium upgrade)\nLink: https://hsquizbowl.org/forums/viewtopic.php?f=123&t=24615&p=381111&hilit=FACE#p381111", false)
			.addField(evert, "Everclue is a bot specifically made for PKs. Although its' creator plans on adding more functionality, the bot is great at what it does.\nPricing - Free (Includes premium upgrade)\nLink: https://hsquizbowl.org/forums/viewtopic.php?f=123&t=24311", false)
	  		.addField(pkbot, "A clean bot for PKs on discord that runs smoothly and does its' job perfectly. It even has 'PK' in the name!\nPricing - Free\nLink (Invite bot to discord server): https://discord.com/api/oauth2/authorize?client_id=741019043926114304&permissions=536988672&scope=bot", false)
	 		.addField(chest, "An easy-to-use bot that will let you get started on PKs in no time. Customize your pk experience with a bunch of customization options.\nPricing - Free\nLink: https://github.com/Bubblebyb/Chestnut/wiki")		
	 	
	 		msg.channel.send(embed)



 	}

  if(command === getVar(msg, "prefix") + "scorecheck" || command === getVar(msg, "prefix") + "sc") {

  	pString = "";

  	for(var ti = 0; ti < Object.keys(getVar(msg, "teams")).length; ti++) {
  		var team = Object.keys(getVar(msg, "teams"))[ti];
  		pString = pString + "**" + team + "** - __" + getVar(msg, "teams")[team].score + "__ [" + getPpbForName(msg, team) +  " PPB]\n";
  		for(i = 0; i < getVar(msg, "players").length; i++) {
  			if(getVar(msg, "players")[i][3].team == team) {
				var userName = msg.guild.members.cache.get(getVar(msg, "players")[i][0]).nickname;
				if(userName == null) {
					userName = client.users.cache.get(getVar(msg, "players")[i][0]).username;
				}
		  		pString = pString + userName + " : " + getVar(msg, "players")[i][1] + " (" + getVar(msg, "players")[i][3].power + "/" + getVar(msg, "players")[i][3].ten + "/" + getVar(msg, "players")[i][3].neg + ") [" + getPpgForId(msg, getVar(msg, "players")[i][0]) + " PP20TUH]\n";
  			}
  		}
  		pString = pString + "\n";
  	}

  	pString = pString + "**Individual**\n";

  	for(i = 0; i < getVar(msg, "players").length; i++) {
  		if(getVar(msg, "players")[i][3].team == "") {
			var userName = msg.guild.members.cache.get(getVar(msg, "players")[i][0]).nickname;
			if(userName == null) {
				userName = client.users.cache.get(getVar(msg, "players")[i][0]).username;
			}
	  		pString = pString + userName + " : " + getVar(msg, "players")[i][1] + " (" + getVar(msg, "players")[i][3].power + "/" + getVar(msg, "players")[i][3].ten + "/" + getVar(msg, "players")[i][3].neg + ") [" + getPpgForId(msg, getVar(msg, "players")[i][0]) + " PP20TUH]\n";
  		}
  	}

  		var tuNum = getVar(msg, "readingTu");

  	  const embed = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle('Scorecheck')
		.setDescription('Tossup ' + tuNum)
		.addField('Team scores and individual scores', pString, false)
  	msg.channel.send(embed);
  }

  if (command === getVar(msg, "prefix") + "settings") {
  	if(args[0] === "list") {
  	  const embed = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle('Settings')
		.setDescription("Customize your playing experience here.")
		.addField('Base rules', getEmojiFor(getVar(msg, "allowBuzzMultipleTimes")) + " - Allow multiple buzzes per tossup [AllowMultipleBuzz]\n" + getEmojiFor(getVar(msg, "allowTalkingDuringGame")) + " - Allow talking during the reading of tossups. [AllowTalk]\n" + getEmojiFor(getVar(msg, "enableCelebration")) + " - Enable the 'celebration' that pops up when a player reaches a point multiple of 100 [AllowCelebration]\n" + getEmojiFor(getVar(msg, "enableBonuses")) + " - Enable the reading of bonuses to teams [enableBonuses]\n**" + getVar(msg, "prefix") + "** - This server's prefix. [Prefix]")
		.addField('Timing', "**" + getVar(msg, "buzzTime") + "ms** - Time given after buzz before being negged. [BuzzTime]\n**" + getVar(msg, "protestTimeout") + "ms** - Time given to protest or confirm an answer before it is automatically ruled as upheld. [ProtestTime]\n**" + getVar(msg, "bonusTime") + "ms** - Time given to answer every part of a bonus. [BonusTime]");
  		msg.channel.send(embed)
  	}

  	if(args[0] === "reset") {
  		var id = msg.guild.id;
  		var savedData = gameData[id];
		gameData[id] = createEmptyServerData();
		gameData[id].canUsePing = false;
		setTimeout(function(){setVar(msg, "canUsePing", true); }, getVar(msg, "pingTimeout"));
	  	 const embed = new Discord.MessageEmbed()
			.setColor('#0000ff')
			.setTitle('Settings')
			.setDescription("Guild settings reset.")
	  		msg.channel.send(embed)
  	}

  	if(args[0] === "edit") {
  		if(args[1] == "AllowMultipleBuzz") {
  			if(args[2] == "true") {
  				setVar(msg, "allowBuzzMultipleTimes", true)
  				addEvent(msg, msg.author.username + " set 'AllowMultipleBuzz' to TRUE", msg.createdTimestamp, [])
  				msg.reply("set 'AllowMultipleBuzz' to TRUE")
  			} else if(args[2] == "false") {
  				setVar(msg, "allowBuzzMultipleTimes", false)
  				addEvent(msg, msg.author.username + " set 'AllowMultipleBuzz' to FALSE", msg.createdTimestamp, [])
  				msg.reply("set 'AllowMultipleBuzz' to FALSE")
  			}
  		}

  		if(args[1] == "AllowTalk") {
  			if(args[2] == "true") {
  				setVar(msg, "allowTalkingDuringGame", true)
  				addEvent(msg, msg.author.username + " set 'AllowTalk' to TRUE", msg.createdTimestamp, [])
  				msg.reply("set 'AllowTalk' to TRUE")
  			} else if(args[2] == "false") {
  				setVar(msg, "allowTalkingDuringGame", false)
  				addEvent(msg, msg.author.username + " set 'AllowTalk' to FALSE", msg.createdTimestamp, [])
				msg.reply("set 'AllowTalk' to FALSE")
  			}
  		}

   		if(args[1] == "AllowCelebration") {
  			if(args[2] == "true") {
  				setVar(msg, "enableCelebration", true)
  				addEvent(msg, msg.author.username + " set 'AllowCelebration' to TRUE", msg.createdTimestamp, [])
  				msg.reply("set 'AllowCelebration' to TRUE")
  			} else if(args[2] == "false") {
  				setVar(msg, "enableCelebration", false)
  				addEvent(msg, msg.author.username + " set 'AllowCelebration' to FALSE", msg.createdTimestamp, [])
  				msg.reply("set 'AllowCelebration' to FALSE")
  			}
  		}

    	if(args[1] == "enableBonuses") {
  			if(args[2] == "true") {
  				setVar(msg, "enableBonuses", true)
  				addEvent(msg, msg.author.username + " set 'enableBonuses' to TRUE", msg.createdTimestamp, [])
  				msg.reply("set 'enableBonuses' to TRUE")
  			} else if(args[2] == "false") {
  				setVar(msg, "enableBonuses", false)
  				addEvent(msg, msg.author.username + " set 'enableBonuses' to FALSE", msg.createdTimestamp, [])
  				msg.reply("set 'enableBonuses' to FALSE")
  			}
  		}

  		if(args[1] == "BuzzTime") {
  			setVar(msg, "buzzTime", parseInt(args[2]))
  			msg.reply("set 'BuzzTime' to " + parseInt(args[2]))
  			addEvent(msg, msg.author.username + " set 'BuzzTime' to " + parseInt(args[2]), msg.createdTimestamp, [])
  		}

  		if(args[1] == "BonusTime") {
  			setVar(msg, "bonusTime", parseInt(args[2]))
  			msg.reply("set 'BonusTime' to " + parseInt(args[2]))
  			addEvent(msg, msg.author.username + " set 'BonusTime' to " + parseInt(args[2]), msg.createdTimestamp, [])
  		}

  		if(args[1] == "ProtestTime") {
  			setVar(msg, "protestTimeout", parseInt(args[2]))
  			msg.reply("set 'ProtestTime' to " + parseInt(args[2]))
  			addEvent(msg, msg.author.username + " set 'ProtestTime' to " + parseInt(args[2]), msg.createdTimestamp, [])
  		}

  		if(args[1] == "Prefix") {
  			setVar(msg, "prefix", args[2].charAt(0))
  			msg.reply("set 'Prefix' to " + args[2].charAt(0))
  			addEvent(msg, msg.author.username + " set 'Prefix' to " + args[2].charAt(0), msg.createdTimestamp, [])
  		}
  	}
  }

  if (command === getVar(msg, "prefix") + "play") {
  	if(getVar(msg, "isPaused")) {
  		msg.channel.send(":arrow_right: Game will resume in **3** seconds.").then(message => {
  			addEvent(msg, msg.author.username + " resumed the game", msg.createdTimestamp, [])
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

 	//https://discord.com/oauth2/authorize?client_id=294889875944112128&permissions=36793408&scope=bot
	if(command === getVar(msg, "prefix") + "invite") {
		const embed = new Discord.MessageEmbed()
		.setColor('#00ffff')
		.setTitle('Invite')
		.setDescription("https://discord.com/oauth2/authorize?client_id=294889875944112128&permissions=36793408&scope=bot \n\nPlease note that the bot is currently in open beta, and you may run into bugs whilst using it.")
		msg.channel.send(embed)
	}

  if (command === getVar(msg, "prefix") + "buzz") {
 	
  		if(msg.guild.members.cache.get(client.user.id).voice.channel == msg.member.voice.channel && msg.guild.members.cache.get(client.user.id).voice.channel !== null) {
		  	var joined=false;
		  	for(i=0;i<getVar(msg, "players").length;i++) {
		  		if(getVar(msg, "players")[i][0] == msg.author.id) {
		  			joined=true;
		  		}
		  	}

		  	if(joined == false) {
		  		var newPlayerList = getVar(msg, "players");
			  	newPlayerList.push([msg.author.id, 0, false, {"power":0, "ten":0, "neg":0, "team":"", "mobile":0}]);
			  	setVar(msg, "players", newPlayerList);
			  	playersCurrentlyInGame++;
			  	addEvent(msg, msg.author.username + " joined the game", msg.createdTimestamp, [])
			  	msg.reply("added as a player");

		  	}
	  	}

	  	handleBuzz(msg, msg.author.id);

  }

  if(command === getVar(msg, "prefix") + "join") {

	if(msg.guild.members.cache.get(client.user.id).voice.channel == msg.member.voice.channel && msg.guild.members.cache.get(client.user.id).voice.channel !== null) {
	  	var joined=false;
	  	for(i=0;i<getVar(msg, "players").length;i++) {
	  		if(getVar(msg, "players")[i][0] == msg.author.id) {
	  			joined=true;
	  		}
	  	}

	  	if(joined == false) {
	  		var newPlayerList = getVar(msg, "players");
		  	newPlayerList.push([msg.author.id, 0, false, {"power":0, "ten":0, "neg":0, "team":"", "mobile":0}]);
		  	setVar(msg, "players", newPlayerList);
		  	playersCurrentlyInGame++;
		  	addEvent(msg, msg.author.username + " joined the game", msg.createdTimestamp, [])
		  	msg.reply("added as a player");

	  	}
	} else {
		msg.reply("You can only join a game if you are in the bot's voice channel!")
	}
  }

  if(command === getVar(msg, "prefix") + "leave") {
  	for(i=0;i<getVar(msg, "players").length;i++) {
  		if(getVar(msg, "players")[i][0] == msg.author.id) {
  			var newPlayerList = getVar(msg, "players");
  			newPlayerList.splice(i, 1);
  			setVar(msg, "players", newPlayerList);
  			playersCurrentlyInGame--;
  			msg.reply("removed as a player");
  			addEvent(msg, msg.author.username + " left the game", msg.createdTimestamp, [])
  		}
  	}
  }

  if(command === getVar(msg, "prefix") + "preset" || command === getVar(msg, "prefix") + "ps") {
  	const cmdArg = args.shift().toLowerCase();
  	if(cmdArg == "generate" || cmdArg == "gen") {
  		var opString = args.join(" ");
  		var rx = / -public/gi
  		var public = (opString.match(rx) != null)


		opString = opString.replace(rx, "")

  		var newPresetList = getVar(msg, "presets");
  		if(!public) {
  			newPresetList[opString] = {diff:getVar(msg,"difficultyList"), cats:getVar(msg,"category_list")}
  		} else {
  			public_presets[opString] = {diff:getVar(msg,"difficultyList"), cats:getVar(msg,"category_list")}
			fs.writeFile('public_presets.json', JSON.stringify(public_presets), (err) => {
			  if (err) throw err;
			  console.log('The file has been saved!');
			});
  		}
  		setVar(msg, "presets", newPresetList);

  		msg.reply("Created preset " + opString + "     [Public: " + public + "]");
  	}

  	if(cmdArg == "list" || cmdArg == "ls") {

  		var combinedPresets = {
  			...public_presets,
  			...getVar(msg, "presets")
  		}

	  	if(typeof combinedPresets[args.join(" ")] !== null) {
	   		var cats = ""
			var newCategoryList = combinedPresets[args.join(" ")].cats;
			console.log(newCategoryList)
			for(var j = 0; j < newCategoryList.length; j++) {
				cats = cats + getSubcatNameById(newCategoryList[j]) + "\n";
			}

			var newDiffList = combinedPresets[args.join(" ")].diff;


			embed = new Discord.MessageEmbed()
			.setColor('#0000ff')
			.setTitle("Preset " + args.join(" "))
			.addField("Categories", cats)
			.addField("Difficulty", newDiffList.join("\n"))

			msg.channel.send(embed)
		} else {
			msg.reply("This preset does not exist.")
		}
  	}

  	if(cmdArg == "browse") {
  		var localPresets = "";
  		console.log(getVar(msg, "presets"));
  		for(var i = 0; i < Object.keys(getVar(msg, "presets")).length; i++) {
  			var name = Object.keys(getVar(msg, "presets"));
  			var preset = getVar(msg, "presets")[name];
  			localPresets = localPresets + "__**" + name + "**__\n"

	   		var cats = "__Categories__\n"
			var newCategoryList = preset.cats;
			for(var j = 0; j < newCategoryList.length; j++) {
				if(j > 5) {
					cats = cats + "  [...]\n";
					break;
				}
				cats = cats + getSubcatNameById(newCategoryList[j]) + ", ";
			}
			
	   		var diff = "__Difficulty__\n"
			var newCategoryList = preset.diff;
			for(var j = 0; j < newCategoryList.length; j++) {
				if(j > 5) {
					diff = diff + "  [...]\n";
					break;
				}
				diff = diff + newCategoryList[j] + ", ";
			}
			localPresets = localPresets + cats + "\n" + diff + "\n\n";
  		}

  		var publicPresets = getPublicPresets();

  		if(localPresets == "")
  			localPresets = "[No local presets]";
  		if(publicPresets == "")
  			publicPresets = "[No public presets]";


		embed = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle("Browse presets")
		.addField("Local", localPresets)
		.addField("Public", publicPresets)


		msg.channel.send(embed);
  	}

  }

  if(command === getVar(msg, "prefix") + "help") {
  	  const embedPg1 = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle('PopBot')
		.setDescription('A Quizbowl moderator bot.')
		.addField('Basic usage', 'Use /read to begin a reading session. The bot will join your current voice chat and begin broadcasting tossups. \n/join - Join a game of QB\n/leave - Leave the game\n/pause - Pause reading\n/play - Continue reading (unpause)\n/buzz - Buzz on the current tossup.\n/mobile - Open the prompt to enable mobile mode.', false)
		.addField('Customization (1/2)', 'Before beginning reading, customize what questions you would like to hear with these commands:\n/category [add|remove] [category_name]/[subcategory_name] - Add or remove categories and subcategories. Subcategory is optional.\n/cat list - Lists the currently added categories.\n/cat reset - Clear all categories\n/difficulty [1-9] - Set difficulty of tossups using the QuizDB difficulty scale. You can set multiple difficulties by seperating them with + signs. (I.E. /diff 3+5+8)', false)
		.addField('Customization (2/2)', 'Every server has settings that persist between bot resets. These settings can be viewed with /settings list.\nEvery setting has it\'s status, a brief explanation, and an identifier that can be used to change the value of a setting using /settings edit [Identifier]', false)
		.addField('Rules', "This bot uses NAQT rules. 15 points power, 10 point tu, and -5 on negs.\nUpon buzzing, you will be recognized and any messages from other players will be deleted. Enter your answer to proceed. You will automatically be negged after __7__ seconds if you do not provide an answer.", false)
		.addField('Teams', "This bot supports teams. Create a team with /team create [team_name], and join with /team join [team_name]. Teams can be removed with /team delete [team_name], and you can leave any team you are on with just /team leave. Once a player on a team buzzes, their whole team will be unable to buzz for the current tossup. Furthermore, all the score of the players on a team is added to the team's score.", false)
		.addField('Presets', "Presets can be made to be able to play a specific set of questions at a specific difficulty of your choosing. /preset generate [name|name -public] (/ps gen) will generate a preset from the data you currently have added.\n/preset list [name] - View a specific preset\n/preset browse - Browse all local and 5 public presets chosen at random.\n/read [preset] - Plays a specific preset.", false)
		.addField('Protests', "When you give an answer to a tossup, the bot will message you to ensure that your answer should have been accepted or not. Pressing the reaction will overrule the decision of the bot. You can then return to the game room via the url provided.", false)
		.addField('A Final Note', "PopBot (or whatever this bot will be called) will never cost anything. In fact, once I get this bot out and see that it works and is stable, I intend to open source it completely, and allow anybody to host it. When this happens I will provide detailed instructions on how to host it yourself and you will be able to make any changes you wish.", false)
		.addField('Support', "A link to the support server has been added below.", false)
		.setFooter("Bot created by Michael Karpov [Barrington IL]. DrakonMichael#9583")
  	



	if(typeof args[0] != "undefined") {
		if(args[0] == "verbose") {
		  	msg.channel.send(embedPg1).then(m => {
		  		msg.channel.send("https://discord.gg/jQZH65FUyb")
		  	})
			return;
		} 
	}
  	msg.author.send(embedPg1).then(m => {
  		msg.author.send("https://discord.gg/jQZH65FUyb")
  	})

  	  const Newembed = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle('Help')
		.setDescription('The help message has been sent to you.')

	msg.channel.send(Newembed);
  }

  if(command === getVar(msg, "prefix") + "cat" || command === getVar(msg, "prefix") + "category") {
  	console.log("Before iterating: " + category_mapping.length);
  	var cmdArg = args.shift().toLowerCase();
  	var arg = args.join(" ");
  	var scArgs = arg.split("/")
  	if(cmdArg == "add") {
  		var catToAdd = scArgs[0];
  		if(typeof category_shortcuts[catToAdd] != "undefined") {
  			catToAdd = category_shortcuts[catToAdd]
  		}

  		if(catToAdd == "everything" || catToAdd == "all") {
  			setVar(msg, "category_list", [])
  			var newCategoryList = [];
  			for (var i = 0; i < category_mapping.length; i++) {
	  			newCategoryList = newCategoryList.concat(getSubcategoriesForCategory(category_mapping[i]["id"]))
	  			
  			}
  			setVar(msg, "category_list", newCategoryList)
  			msg.reply("Added every category.");
  			return;
  		}


  		if(scArgs.length == 1) {
  			if(categoryExists(catToAdd)) {
		  		if(categoryFullyInCategoryList(msg, getCatIdByName(catToAdd))) {
		  			msg.reply("This category is already in the category list.");
		  		} else {
		  			var category_id = getCatIdByName(catToAdd);
		  			var category_subcats = getSubcategoriesForCategory(category_id);

		  			var newCategoryList = getVar(msg, "category_list");
		  			for(var i = 0; i < category_subcats.length; i++) {
		  				if(!isInCategorylist(msg, category_subcats[i])) {
		  					newCategoryList.push(category_subcats[i])
		  				}
		  			}
		  			setVar(msg, "category_list", newCategoryList);
		  			
		  			msg.reply("Added " + catToAdd + "/all to the category list.")
		  		}
	  		} else {
	  			msg.reply("Category " + catToAdd + " does not exist.")
	  		}
  		} else {
  			var newCategoryList = getVar(msg, "category_list");
  			var subcatToAdd = scArgs[1]
	  		if(typeof subcat_shortcuts[scArgs[1]] != "undefined") {
	  			subcatToAdd = subcat_shortcuts[scArgs[1]]
	  		}

  			if(subcatToAdd == "all") {
  				msg.reply(" You can add all the subcategories for a category by just doing /cat add [category_name]");
  				return;
  			}

  			if(getSubcatIDByName(catToAdd, subcatToAdd)) {
	  			if(!isInCategorylist(msg, getSubcatIDByName(catToAdd, subcatToAdd))) {
	  				newCategoryList.push(getSubcatIDByName(catToAdd, subcatToAdd))
	  				setVar(msg, "category_list", newCategoryList);
	  				msg.reply("Added " + catToAdd + "/" + subcatToAdd + " to the category list.")
	  			} else {
	  				msg.reply(catToAdd + "/" + subcatToAdd + " is already in the category list.")
	  			}
  			} else {
  				msg.reply(catToAdd + "/" + subcatToAdd + " does not exist.")
  			}
  		}

  	}

  	if(cmdArg == "reset" || cmdArg == "clear") {
  		setVar(msg, "category_list", [])
  		msg.reply("Category list reset");
  	}

   	if(cmdArg == "list") {
   		var text = ""
		var newCategoryList = getVar(msg, "category_list");
		for(var j = 0; j < newCategoryList.length; j++) {
			text = text + getSubcatNameById(newCategoryList[j]) + "\n";
		}
		
		embed = new Discord.MessageEmbed()
		.setColor('#0000ff')
		.setTitle("Category list")
		.setDescription(text)

		msg.channel.send(embed)
	  
  	}

  	if(cmdArg == "remove" || cmdArg == "rm") {
  		var catToAdd = scArgs[0];
  		if(typeof category_shortcuts[catToAdd] != "undefined") {
  			catToAdd = category_shortcuts[catToAdd]
  		}

  		if(scArgs.length == 1) {
  			if(categoryExists(catToAdd)) {
	  			var category_id = getCatIdByName(catToAdd);
	  			var category_subcats = getSubcategoriesForCategory(category_id);

	  			var newCategoryList = getVar(msg, "category_list");
	  			for(var i = 0; i < category_subcats.length; i++) {
	  				for(var j = 0; j < newCategoryList.length; j++) {
	  					if(newCategoryList[j] == category_subcats[i]) {
	  						newCategoryList.splice(j, 1);
	  					}
	  				}
	  			}
	  			setVar(msg, "category_list", newCategoryList);
	  			
	  			msg.reply("removed " + catToAdd + "/all from the category list.")
	  		} else {
	  			msg.reply("Category " + catToAdd + " does not exist.")
	  		}
  		} else {
  			var newCategoryList = getVar(msg, "category_list");
  			var subcatToAdd = scArgs[1]
	  		if(typeof subcat_shortcuts[scArgs[1]] != "undefined") {
	  			subcatToAdd = subcat_shortcuts[scArgs[1]]
	  		}

  			if(subcatToAdd == "all") {
  				msg.reply(" You can add all the subcategories for a category by just doing /cat add [category_name]");
  				return;
  			}

  			if(getSubcatIDByName(catToAdd, subcatToAdd)) {
  				var scid = getSubcatIDByName(catToAdd, subcatToAdd);
	  			if(isInCategorylist(msg, getSubcatIDByName(catToAdd, subcatToAdd))) {
	  				for(var j = 0; j < newCategoryList.length; j++) {
	  					if(newCategoryList[j] == scid) {
	  						msg.reply("removed " + catToAdd + "/" + subcatToAdd + " from the category list.")
	  						newCategoryList.splice(j, 1);
	  					}
	  				}
	  				setVar(msg, "category_list", newCategoryList);
	  				
	  			} else {
	  				msg.reply(catToAdd + "/" + subcatToAdd + " is not in the category list.")
	  			}
  			} else {
  				msg.reply(catToAdd + "/" + subcatToAdd + " does not exist.")
  			}
  		}
  	}
  }

  if(command === getVar(msg, "prefix") + "diff" || command === getVar(msg, "prefix") + "difficulty") {

  	setDifficulty(msg, args[0]);
  
  }


  if (command === getVar(msg, "prefix") + "read" || command === getVar(msg, "prefix") + "start") {
  	setVar(msg, "events", []);
  	setVar(msg, "readingUntilTu", -1);


  	

  	if(typeof args[0] != "undefined") {

  		var combinedPresets = {
  			...public_presets,
  			...getVar(msg, "presets")
  		}

  		if(typeof combinedPresets[args.join(" ")] != "undefined") {



  			var preset = combinedPresets[args.join(" ")];
  			setVar(msg, "category_list", preset.cats);
  			setVar(msg, "difficultyList", preset.diff);
  			msg.reply("Playing preset " + args.join(" "))

  		} else {
	  		setVar(msg, "readingUntilTu", parseInt(args[0]));
	  		msg.reply("Reading " + args[0] + " tossups.")
  		}
  	}

  	setVar(msg, "readingTextChannel", msg.channel.id)
  	var joined=false;
  	for(i=0;i<getVar(msg, "players").length;i++) {
  		if(getVar(msg, "players")[i][0] == msg.author.id) {
  			joined=true;
  		}
  	}

  	if(joined == false) {
	  	var newPlayerList = getVar(msg, "players");
		newPlayerList.push([msg.author.id, 0, false, {"power":0, "ten":0, "neg":0, "team":"", "mobile":0}]);
		setVar(msg, "players", newPlayerList);
	  	playersCurrentlyInGame++;
	  	addEvent(msg, msg.author.username + " joined the game", msg.createdTimestamp, [])
	  	msg.reply("added as a player");
  	}
  	setVar(msg, "readingTu", 0);
    // Only try to join the sender's voice channel if they are in one themselves
    if(getVar(msg, "difficultyList").length > 0) {
	    if(getVar(msg, "category_list").length > 0) {
		    if (msg.member.voice.channel) {
		    	if(!getVar(msg, "gameBeingPlayed")) {
			    	if(msg.member.voice.channel.permissionsFor(msg.guild.members.cache.get(client.user.id)).has('CONNECT'))  {
			    	  	setVar(msg, "gameBeingPlayed", true)
			    	
				    	
				    	category_query = getVar(msg, "category_list").join(" OR subcategory_id = ");

				    	pool.query("SELECT * FROM tossups WHERE subcategory_id = " + category_query, (err, res) => {
						  setVar(msg, "tossups", shuffle(res.rows))
						})

						const voiceChannel = msg.member.voice.channel;
					    voiceChannel.join().then(connection => {
					    	setVar(msg, "botVoiceConnection", connection)

					    	setTimeout(function(){
				    			readTossups(msg, msg.channel, connection);
				    		}, 3000);

				    	});
			   		} else {
			   			msg.reply("I don't have permissions to join that channel!")
			   		}
				} else {
					msg.reply('A game is already being played');
				}
		    } else {
		      msg.reply('You need to join a voice channel first!');
		    }
		} else {
			msg.reply("Add a category to read with /cat add [category name]");
		}
	} else {
		msg.reply("Set difficulty with /diff [1-9], If you wish to add multiple difficulties, seperate them with a +.");
	}
  }




  if (command === "/ga" || command === "/globalannounce") {
  	if(msg.author.id == 188031012444307457 || msg.author.id == 691377361937104917) {
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

if (command === getVar(msg, "prefix") + "team") {
	  var cmdArg = args.shift().toLowerCase();
	  var arg = args.join(" ");
	 if(cmdArg == "create") {
	 	if(arg.length > 50) {
	 		msg.reply("You cannot create a team name longer than 50 characters");
	 		return;
	 	}

	 	if(Object.keys(getVar(msg, "teams")).length > maxTeamsAllowed-1) {
	 		msg.reply("You have reached the maximum amount of teams allowed, " + maxTeamsAllowed + ", remove a team with /team delete [team_name] or reset the teams with /team reset");
	 		return;
	 	}
	 	var newTeamsList = getVar(msg, "teams");
	 	if(typeof newTeamsList[arg] == "undefined") {
		 	newTeamsList[arg] = {score:0, hasBuzzed:false, "bonus":{"gotten":0, "points":0}}
		 	setVar(msg, "teams", newTeamsList)
		 	msg.reply("created team " + arg);
		 	addEvent(msg, msg.author.username + " created team " + arg, msg.createdTimestamp, [])
		 } else {
		 	msg.reply("This team already exists.")
		 }
	  }


	if(cmdArg == "reset") {
		setVar(msg, "teams", {})
		msg.reply("Teams reset")
		addEvent(msg, msg.author.username + " reset teams.", msg.createdTimestamp, [])
	}


	if(cmdArg == "delete" || cmdArg == "del") {
		var newTeamsList = getVar(msg, "teams");
		if(typeof newTeamsList[arg] != "undefined") {
		 delete newTeamsList[arg]
		 setVar(msg, "teams", newTeamsList)
		 msg.reply("Deleted team " + arg)
		 addEvent(msg, msg.author.username + " deleted team " + arg, msg.createdTimestamp, [])
		} else {
			msg.reply("This team does not exist.")
		}
	}


	if(cmdArg == "join") {
		var newTeamsList = getVar(msg, "teams");
		if(typeof newTeamsList[arg] != "undefined") {
		 	for(var i = 0; i < getVar(msg, "players").length; i++) {
		 		if(getVar(msg, "players")[i][0] == msg.author.id) {
		 			var newPlayerList = getVar(msg, "players");
		 			newPlayerList[i][3].team = arg;
		 			newPlayerList[i][1] = 0;
		 			newPlayerList[i][2] = false;
		 			newPlayerList[i][3].power = 0;
		 			newPlayerList[i][3].ten = 0;
		 			newPlayerList[i][3].neg = 0;
		 			setVar(msg, "players", newPlayerList);
		 			msg.reply("Joined team " + arg + " [Your stats have been cleared.]")
		 			addEvent(msg, msg.author.username + " joined team " + arg, msg.createdTimestamp, [])
		 			return;
		 		}
		 	}
		 	msg.reply("Join the game first with /join")
		} else {
			msg.reply("This team does not exist.")
		}
	}

	if(cmdArg == "leave") {
		for(var i = 0; i < getVar(msg, "players").length; i++) {
			if(getVar(msg, "players")[i][0] == msg.author.id) {
				var newPlayerList = getVar(msg, "players");
				if(newPlayerList[i][3].team != "") {

					var newTeamList = getVar(msg, "teams");
					newTeamList[newPlayerList[i][3].team].score = newTeamList[newPlayerList[i][3].team].score - newPlayerList[i][1];

			 		newPlayerList[i][3].team = "";
			 		newPlayerList[i][1] = 0;
			 		newPlayerList[i][2] = false;
			 		newPlayerList[i][3].power = 0;
			 		newPlayerList[i][3].ten = 0;
			 		newPlayerList[i][3].neg = 0;
			 		setVar(msg, "players", newPlayerList);
			 		addEvent(msg, msg.author.username + " joined individuals.", msg.createdTimestamp, [])
			 		msg.reply("Left team. [Your stats have been reset]")
		 		} else {
		 			msg.reply("You are not in a team.")
		 		}
			}
		}
	}
}


  if (command === "/restart") {
  	if(msg.author.id == 188031012444307457 || msg.author.id == 691377361937104917) {
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

  }


	if(command === getVar(msg, "prefix") + "ping") {

		if(getVar(msg, "canUsePing")) {
			setVar(msg, "canUsePing", false);
			setTimeout(function(){setVar(msg, "canUsePing", true); }, getVar(msg, "pingTimeout"));

	        var embed = new Discord.MessageEmbed()
	        .setTitle("Pinging...")
	        .setDescription("This may take up to 20 seconds.")

	        msg.channel.send(embed).then(m =>{
	        	calculatePing(m, 0, 0)
	        });
   		} else {
   			msg.reply("This command is still on cooldown.")
   		}
		
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

			const timeOutEmbed = new Discord.MessageEmbed()
			.setColor('#ffff00')
			.setTitle('Protest Resolver - Timed out')
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
									newPlayerList[i][3].neg = newPlayerList[i][3].neg + 1
									if(newPlayerList[i][3].team != "") {
										var newTeamsList = getVar(msg, "teams");
										newTeamsList[newPlayerList[i][3].team].score = newTeamsList[newPlayerList[i][3].team].score - 5;
										setVar(msg, "teams", newTeamsList)
									}

									addEvent(msg, msg.author.username + " negged tossup " + (getVar(msg, "readingTu")+1) + " [-5]", msg.createdTimestamp, ["	-- Answer given: " + msg.content, "	-- Answerline: " + getVar(msg, "curAnswer")]);
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
									.setFooter(getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round)
										getVar(msg, "curBM").channel.send(embed).then(timeoutMessage => {
											addEvent(msg, "tossup " + (getVar(msg, "readingTu")+1) + " went dead.", timeoutMessage.createdTimestamp, ["	-- Text: " + getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"], "	-- Answer: " + getVar(msg, "curAnswer"), "	-- INFO: " + getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round]);
										})

									getVar(msg, "curBM").edit(getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"]);
									setVar(msg, "currentTuCanTimeout", false)
									setVar(msg, "readingTu", getVar(msg, "readingTu") + 1);
								

							}
						setVar(msg, "canBuzz", true);
						setVar(msg, "buzz", null);
						clearTimeout(getVar(msg, "timeoutTimer"))
					}
				})

				protestDM.awaitReactions(filterY, { max: 1, time: getVar(msg, "protestTimeout"), errors: ['time'] })
					.then(collected => {
						if(canProtest) {
							canProtest = false;
							msg.channel.send(":+1: Judgement overriden. Protest accepted.");
							protestDM.channel.send(":+1: Judgement overriden. Protest accepted.");
							message.edit(":white_check_mark: Correct! **+" + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup")) + "** points");

							var userName = msg.guild.members.cache.get(msg.author.id).nickname;
							if(userName == null) {
								userName = msg.author.username;
							}

				  			const embed = new Discord.MessageEmbed()
							.setColor('#00ff00')
							.setTitle('Tossup ' + (getVar(msg, "readingTu") + 1))
							.setDescription(userName + " got this tossup.")
							.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
							.addField('Answer given: ', msg.content, false)
							.setFooter(getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd:" + getVar(msg, "tossups")[getVar(msg, "readingTu")].round)

							msg.channel.send(embed);
							getVar(msg, "curBM").edit(getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"]);
							var playerTeam = ""
							for(i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									var newPlayerList = getVar(msg, "players");
									newPlayerList[i][1] = newPlayerList[i][1] + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup"));
									if((10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup") == 15)) {
										addEvent(msg, msg.author.username + " powered tossup " + (getVar(msg, "readingTu")+1) + " [+15]", msg.createdTimestamp, ["	-- Answer given: " + msg.content, "	-- Answerline: " + getVar(msg, "curAnswer")]);
										newPlayerList[i][3].power = newPlayerList[i][3].power + 1
									} else if ((10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup") == 10)) {
										addEvent(msg, msg.author.username + " got tossup " + (getVar(msg, "readingTu")+1) + " [+10]", msg.createdTimestamp, ["	-- Answer given: " + msg.content, "	-- Answerline: " + getVar(msg, "curAnswer")]);
										newPlayerList[i][3].ten = newPlayerList[i][3].ten + 1
									}

									if(newPlayerList[i][3].team != "") {
										playerTeam = newPlayerList[i][3].team;
										var newTeamsList = getVar(msg, "teams");
										newTeamsList[newPlayerList[i][3].team].score = newTeamsList[newPlayerList[i][3].team].score + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup"));
										setVar(msg, "teams", newTeamsList)
									}

									setVar(msg, "players", newPlayerList);
									if(getVar(msg, "players")[i][1] % 100 == 0 && getVar(msg, "enableCelebration")) {
										celebrate(msg, getVar(msg, "players")[i][0], getVar(msg, "players")[i][1]);
									}
								}
							}
							setVar(msg, "buzz", null);
							clearTimeout(getVar(msg, "timeoutTimer"))
							setVar(msg, "currentTuCanTimeout", false)
							if(getVar(msg, "enableBonuses") && playerTeam != "") {
								readBonus(msg)
							} else {
								setVar(msg, "readingTu", getVar(msg, "readingTu")+1);
								setVar(msg, "canBuzz", true);
							}
						}
					})
					.catch(collected => {
						if(canProtest) {
							canProtest = false;
							protestDM.edit(timeOutEmbed)
							message.edit(":x: Incorrect. **-5** points");
							for(i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									var newPlayerList = getVar(msg, "players");
									newPlayerList[i][1] = newPlayerList[i][1] - 5;
									newPlayerList[i][3].neg = newPlayerList[i][3].neg + 1
									addEvent(msg, msg.author.username + " negged tossup " + (getVar(msg, "readingTu")+1) + " [-5]", msg.createdTimestamp, ["	-- Answer given: " + msg.content, "	-- Answerline: " + getVar(msg, "curAnswer")]);
									if(newPlayerList[i][3].team != "") {
										var newTeamsList = getVar(msg, "teams");
										newTeamsList[newPlayerList[i][3].team].score = newTeamsList[newPlayerList[i][3].team].score - 5;
										setVar(msg, "teams", newTeamsList)
									}
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
								.setFooter(getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round)
										getVar(msg, "curBM").channel.send(embed).then(timeoutMessage => {
											addEvent(msg, "tossup " + (getVar(msg, "readingTu")+1) + " went dead.", timeoutMessage.createdTimestamp, ["	-- Text: " + getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"], "	-- Answer: " + getVar(msg, "curAnswer"), "	-- INFO: " + getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round]);
										})

								getVar(msg, "curBM").edit(getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"]);
								setVar(msg, "currentTuCanTimeout", false)
								setVar(msg, "readingTu", getVar(msg, "readingTu") + 1)
							}
							setVar(msg, "canBuzz", true);
							setVar(msg, "buzz", null);
							clearTimeout(getVar(msg, "timeoutTimer"))

						}
					});
			})
			.catch(err => {
				message.delete();
				msg.channel.send("Only players to which the bot can send DMs to can play PopBot games. Please enable direct messages from this server's members to play.");
				setVar(msg, "canBuzz", true);
				setVar(msg, "buzz", null);

				for(var i=0;i<getVar(msg, "players").length;i++) {
					if(getVar(msg, "players")[i][0] == msg.author.id) {
						var newPlayerList = getVar(msg, "players");
						newPlayerList.splice(i, 1);	
						setVar(msg, "players", newPlayerList);
					}
				}

				readTu(msg, getVar(msg, "botVoiceConnection"), getVar(msg, "curPC"), getVar(msg, "curC"), getVar(msg, "curP"), getVar(msg, "curBM"));
				return;
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

			const timeOutEmbed = new Discord.MessageEmbed()
			.setColor('#ffff00')
			.setTitle('Protest Resolver - Timed out')
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
							var userName = msg.guild.members.cache.get(msg.author.id).nickname;
							if(userName == null) {
								userName = msg.author.username;
							}
				  			const embed = new Discord.MessageEmbed()
							.setColor('#00ff00')
							.setTitle('Tossup ' + (getVar(msg, "readingTu")+1))
							.setDescription(userName + " got this tossup.")
							.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
							.addField('Answer given: ', msg.content, false)
							.setFooter(getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round)
							msg.channel.send(embed);
							getVar(msg, "curBM").edit(getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"]);
							var playerTeam = "";
							for(i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									var newPlayerList = getVar(msg, "players");
									newPlayerList[i][1] = newPlayerList[i][1] + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup"));
									if((10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup") == 15)) {
										addEvent(msg, msg.author.username + " powered tossup " + (getVar(msg, "readingTu")+1) + " [+15]", msg.createdTimestamp, ["	-- Answer given: " + msg.content, "	-- Answerline: " + getVar(msg, "curAnswer")]);
										newPlayerList[i][3].power = newPlayerList[i][3].power + 1
									} else if ((10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup") == 10)) {
										addEvent(msg, msg.author.username + " got tossup " + (getVar(msg, "readingTu")+1) + " [+10]", msg.createdTimestamp, ["	-- Answer given: " + msg.content, "	-- Answerline: " + getVar(msg, "curAnswer")]);
										newPlayerList[i][3].ten = newPlayerList[i][3].ten + 1
									}

									if(newPlayerList[i][3].team != "") {
										playerTeam = newPlayerList[i][3].team;
										var newTeamsList = getVar(msg, "teams");
										newTeamsList[newPlayerList[i][3].team].score = newTeamsList[newPlayerList[i][3].team].score + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup"));
										setVar(msg, "teams", newTeamsList)
									}

									setVar(msg, "players", newPlayerList);
									if(getVar(msg, "players")[i][1] % 100 == 0 && getVar(msg, "enableCelebration")) {
										celebrate(msg, getVar(msg, "players")[i][0], getVar(msg, "players")[i][1]);
									}
								}
							}
							if(getVar(msg, "enableBonuses") && playerTeam != "") {
								readBonus(msg)
							} else {
								setVar(msg, "readingTu", getVar(msg, "readingTu")+1);
								setVar(msg, "canBuzz", true);
							}
							setVar(msg, "currentTuCanTimeout", false)
							clearTimeout(getVar(msg, "timeoutTimer"))
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
									newPlayerList[i][3].neg = newPlayerList[i][3].neg + 1
									addEvent(msg, msg.author.username + " negged tossup " + (getVar(msg, "readingTu")+1) + " [-5]", msg.createdTimestamp, ["	-- Answer given: " + msg.content, "	-- Answerline: " + getVar(msg, "curAnswer")]);
									if(newPlayerList[i][3].team != "") {
										var newTeamsList = getVar(msg, "teams");
										newTeamsList[newPlayerList[i][3].team].score = newTeamsList[newPlayerList[i][3].team].score - 5;
										setVar(msg, "teams", newTeamsList)
									}

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
								.setFooter(getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round)
										getVar(msg, "curBM").channel.send(embed).then(timeoutMessage => {
											addEvent(msg, "tossup " + (getVar(msg, "readingTu")+1) + " went dead.", timeoutMessage.createdTimestamp, ["	-- Text: " + getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"], "	-- Answer: " + getVar(msg, "curAnswer"), "	-- INFO: " + getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round]);
										})

								getVar(msg, "curBM").edit(getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"]);
								setVar(msg, "currentTuCanTimeout", false)
								setVar(msg, "readingTu", getVar(msg, "readingTu") + 1)
							}
							setVar(msg, "canBuzz", true);
							setVar(msg, "buzz", null);
							clearTimeout(getVar(msg, "timeoutTimer"))

						}
					})
					.catch(collected => {
						if(canProtest) {
							canProtest = false;
							protestDM.edit(timeOutEmbed);
							message.edit(":white_check_mark: Correct! **+" + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup")) + "** points");
							var userName = msg.guild.members.cache.get(msg.author.id).nickname;
							if(userName == null) {
								userName = msg.author.username;
							}
				  			const embed = new Discord.MessageEmbed()
							.setColor('#00ff00')
							.setTitle('Tossup ' + (getVar(msg, "readingTu")+1))
							.setDescription(msg.author.username + " got this tossup.")
							.addField('Answerline: ', getVar(msg, "curAnswer").split("<strong>").join("__**").split("</strong>").join("**__"), false)
							.addField('Answer given: ', msg.content, false)
							.setFooter(getTournamentName(getVar(msg, "tossups")[getVar(msg, "readingTu")].tournament_id) + " // rd: " + getVar(msg, "tossups")[getVar(msg, "readingTu")].round)
							msg.channel.send(embed);
							getVar(msg, "curBM").edit(getVar(msg, "tossups")[getVar(msg, "readingTu")]["text"]);
							var playerTeam = ""
							for(i=0;i<getVar(msg, "players").length;i++) {
								if(getVar(msg, "players")[i][0] == msg.author.id) {
									var newPlayerList = getVar(msg, "players");
									newPlayerList[i][1] = newPlayerList[i][1] + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup"));
									if((10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup") == 15)) {
										addEvent(msg, msg.author.username + " powered tossup " + (getVar(msg, "readingTu")+1) + " [+15]", msg.createdTimestamp, ["	-- Answer given: " + msg.content, "	-- Answerline: " + getVar(msg, "curAnswer")]);
										newPlayerList[i][3].power = newPlayerList[i][3].power + 1
									} else if ((10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup") == 10)) {
										addEvent(msg, msg.author.username + " got tossup " + (getVar(msg, "readingTu")+1) + " [+10]", msg.createdTimestamp, ["	-- Answer given: " + msg.content, "	-- Answerline: " + getVar(msg, "curAnswer")]);
										newPlayerList[i][3].ten = newPlayerList[i][3].ten + 1
									}

									if(newPlayerList[i][3].team != "") {
										playerTeam = newPlayerList[i][3].team;
										var newTeamsList = getVar(msg, "teams");
										newTeamsList[newPlayerList[i][3].team].score = newTeamsList[newPlayerList[i][3].team].score + (10 + ((1-getVar(msg, "curP"))*5)*getVar(msg, "canPowerThisTossup"));
										setVar(msg, "teams", newTeamsList)
									}

									setVar(msg, "players", newPlayerList);
									if(getVar(msg, "players")[i][1] % 100 == 0 && getVar(msg, "enableCelebration")) {
										celebrate(msg, getVar(msg, "players")[i][0], getVar(msg, "players")[i][1]);
									}
								}
							}
							setVar(msg, "currentTuCanTimeout", false)
							if(getVar(msg, "enableBonuses") && playerTeam != "") {
								readBonus(msg)
							} else {
								setVar(msg, "readingTu", getVar(msg, "readingTu")+1);
								setVar(msg, "canBuzz", true);
							}
							setVar(msg, "buzz", null);
							clearTimeout(getVar(msg, "timeoutTimer"))
							
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
