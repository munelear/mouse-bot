const { RichEmbed } = require("discord.js");
const fuzzy = require("fuzzy-predicate");
const request = require("request-promise-native");
const requiredCharacters = require("./../modules/common-characters.js");
const requiredShips = require("./../modules/common-ships.js");

exports.run = async (client, message, cmd, args, level) => { // eslint-disable-line no-unused-vars

    try {
        // Pull in our swgoh databases
        const charactersData = client.swgohData.get("charactersData");
        const shipsData = client.swgohData.get("shipsData");

        // Cool star emojis! Just like in the game!
        const starEmoji = client.emojis.get("416420499078512650");
        const inactiveStarEmoji = client.emojis.get("416422867606044683");

        const [id, searchText, error] = await client.profileCheck(message, args); // eslint-disable-line no-unused-vars
        if (id === undefined) return await message.reply(error).then(client.cmdError(message, cmd));

        const guildMessage = await message.channel.send("Checking... One moment. 👀");

        // Setting up guild id and url for swgoh.gg/api
        let profile = client.cache.get(id + "_profile");
        // Only cache if needed to
        if (profile === undefined || profile.userId === undefined) {
            try {
                await client.cacheCheck(message, id, "");
                profile = client.cache.get(id + "_profile");
            } catch (error) {
                client.errlog(cmd, message, level, error);
                client.logger.error(client, `swgoh.gg profile pull failure within the guildscreen command:\n${error.stack}`);
            }
        } else client.cacheCheck(message, id, ""); // If we don't need to cache, just do it in the background
        if (profile === undefined || profile.userId === undefined) return await guildMessage.edit("I can't find a profile for that username").then(client.cmdError(message, cmd));
        const guildInfo = profile.guildUrl.split("/");
        const guildNum = guildInfo[2];
        const guildName = guildInfo[3].replace(/-/g, " ").toProperCase();
        const url = `https://swgoh.gg/api/guilds/${guildNum}/units/`;
        let guildData = {};

        // Request options for swgoh.gg API
        const options = {
            uri: url,
            json: true
        };

        try {
            // Pull data from swgoh.gg/api
            guildData = await request(options);
        } catch (error) {
            client.errlog(cmd, message, level, error);
            client.logger.error(client, `swgoh.gg guild API pull failure within the guild command:\n${error.stack}`);
        }


        for (var i = 0; i < requiredCharacters.length; i++) {
            const character = requiredCharacters[i];
            const lookup = charactersData.filter(fuzzy(character.name, ["name", "nickname"]));
            if (!lookup) console.log("I couldn't find: " + character.name);
            if (lookup.length > 1) console.log("I found too many matches for: " + character.name);

            // Now we start pulling the character from the data
            const characterKey = lookup[0].base_id;
            const searchTerm = lookup[0].name;

            // Error message if that base_id isn't matched with anything in the guildData
            if (guildData[characterKey] === undefined) {
                await guildMessage.edit(`${message.author}, I don't think anyone in ${guildName} has __${lookup[0].name}__.`);
                continue;
            }

            const sortedCharacterData = guildData[characterKey].sort( (p, c) => p.rarity > c.rarity ? 1 :  p.power > c.power && p.rarity === c.rarity ? 1 :  p.player > c.player && p.power === c.power ? 1 : -1 );
            let loopStar = "";
            let fieldTitle;
            let fieldText;
            let count = 0;
            const searchRarity = character.stars;
            const playerArray = [];

            // Creating the embed
            const embed = new RichEmbed()
                .setAuthor(`${guildName}'s Key Unit Report`)
                .setColor(0xEE7100)
                .setTitle(lookup[0].name)
                .setThumbnail(`https:${lookup[0].image}`)
                .setURL(`https://swgoh.gg/g/${guildNum}/${guildInfo[3]}/unit-search/#${lookup[0].base_id}`);

            // Here we're just getting an array of everyone in the guild to use for
            // the "Not Activated" cases
            guildData["CLONEWARSCHEWBACCA"].forEach(d => {
                playerArray.push(d.player);
            });
            sortedCharacterData.forEach(a => {
                const removePlayer = playerArray.indexOf(a.player);
                playerArray.splice(removePlayer, 1);
            });

            // Add the "Not Activated" field to the embed
            if (playerArray.length > 0) {
                const playerArraySJ = playerArray.sort().join("\n");
                const iStarString = `${inactiveStarEmoji}`.repeat(7);
                // If there's more than five names, split it into two columns
                if (playerArray.length > 5) {
                    const half = Math.round(playerArray.length / 2);
                    embed.addField(`Not Activated (x${playerArray.length})`, playerArray.sort().slice(0, half).join("\n"), true);
                    embed.addField("-", playerArray.sort().slice(half).join("\n"), true);
                }
                else embed.addField(`${iStarString}(x${playerArray.length})`, playerArraySJ, false);
            }

            sortedCharacterData.forEach(c => {
                const characterStar = c.rarity;
                if (characterStar < searchRarity) {

                    if (loopStar !== characterStar) {

                        if (fieldText != undefined) {
                            if (fieldText.length > 950) client.splitText(fieldTitle, fieldText, embed);
                            else embed.addField(fieldTitle, fieldText, false);
                        }

                        loopStar = characterStar;
                        fieldText = "";
                        count = 0;
                    }

                    if (c.gear_level == undefined) fieldText += `${c.level} (${c.power.toLocaleString()}) - ${c.player}\n`;
                    else fieldText += `${c.level}-g${c.gear_level} (${c.power.toLocaleString()}) - ${c.player}\n`;
                    count++;
                    const starString = `${starEmoji}`.repeat(characterStar) + `${inactiveStarEmoji}`.repeat(7 - characterStar);
                    fieldTitle = `${starString} (x${count})`;
                }
            });

            // Can't forget to add the last loop
            if (fieldText == undefined && searchRarity > 1 && searchRarity != 7) return await guildMessage.edit(`${message.author}, no one in ${guildName} has ${searchTerm} at ${searchRarity}${starEmoji} or higher.`);
            else if (fieldText == undefined && searchRarity > 1 && searchRarity == 7) return await guildMessage.edit(`${message.author}, no one in ${guildName} has ${searchTerm} at ${searchRarity}${starEmoji}.`);
            else if (fieldText.length > 950) client.splitText(fieldTitle, fieldText, embed);
            else embed.addField(fieldTitle, fieldText, false);

            await guildMessage.edit("Here's what I found:");
            await message.channel.send({ embed });
        };
    } catch (error) {
        client.errlog(cmd, message, level, error);
        client.logger.error(client, `screen command failure:\n${error.stack}`);
        client.codeError(message);
    }

};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ["gs"],
    arguments: ["user mention", "1-7"],
    permLevel: "User"
};

exports.help = {
    name: "guildscreen",
    category: "Game",
    description: "Looks up the guild of a profile and returns a report of 'required' character statuses",
    usage: "guildscreen [profile url]",
    examples: ["guildscreen https://swgoh.gg/u/necavit"]
};
