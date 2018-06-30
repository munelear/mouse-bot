const { RichEmbed } = require("discord.js");
const request = require("request-promise-native");
const rosterAnalyzer = require("./../modules/roster-analyzer.js");

function transformGuildData(guildData, charactersData, shipsData) {
    const responseObject = {};

    // initialize an object for every player
    guildData["CLONEWARSCHEWBACCA"].forEach(player => {
        responseObject[player.player] = {
            "name": player.player,
            "url": player.url,
            "ships": [],
            "characters": []
        };
    });
    const COMBAT_TYPE_MAP = {
        "1" : "characters",
        "2" : "ships"
    };

    const findMatchingUnit = (unitData, base_id) => {
        let i = 0;
        let matchingUnit;

        while (!matchingUnit && i < unitData.length) {
            if (base_id == unitData[i].base_id) {
                matchingUnit = unitData[i];
                break;
            }

            i++;
        }

        return matchingUnit;
    };

    for (const base_id in guildData) {
        const unit = guildData[base_id];
        let unitType = "characters"; // default to characters

        // look at the first player object, assume the combat type is the same for every entry
        if (unit.length > 0) {
            unitType = COMBAT_TYPE_MAP[unit[0].combat_type];
        }
        const unitData = (unitType === "characters") ? charactersData : shipsData;
        const matchingUnit = findMatchingUnit(unitData, base_id);
        if (!matchingUnit) console.log("I couldn't find: " + base_id);

        unit.forEach(player => {
            // fake out enough fields to make it look like a character roster entry
            responseObject[player.player][unitType].push({
                "description": matchingUnit.name,
                "imageSrc": matchingUnit.image,
                "star": player.rarity,
                "gearLevel": player.gear_level,
                "level": player.level,
                "galacticPower": player.power,
            });
        });
    }

    return responseObject;
}

exports.run = async (client, message, cmd, args, level) => { // eslint-disable-line no-unused-vars

    try {
        // Pull in our swgoh databases
        const charactersData = client.swgohData.get("charactersData");
        const shipsData = client.swgohData.get("shipsData");

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
            client.logger.error(client, `swgoh.gg guild API pull failure within the guildscreen command:\n${error.stack}`);
        }

        const transformedGuildData = transformGuildData(guildData, charactersData, shipsData);
        const playerArray = [];

        for (const playerName in transformedGuildData) {
            const player = transformedGuildData[playerName];
            const rosterStatus = rosterAnalyzer(player.characters, player.ships, charactersData, shipsData);

            // glue in some extra fields to the analysis to keep player records straight
            rosterStatus.name = player.name;
            rosterStatus.url = player.url;

            playerArray.push(rosterStatus);
        }

        // sort by progress indicator, then name
        playerArray.sort((a, b) => ((a.totalProgress - b.totalProgress) || (a.name.localeCompare(b.name))));

        const playerProgressMessages = [];
        // parse out the progress information to stick in the command response
        playerArray.forEach(player => {
            playerProgressMessages.push(`${player.totalProgress} - ${player.name}`);
        });

        // Creating the embed
        const embed = new RichEmbed()
            .setAuthor(`${guildName}'s Key Unit Report`)
            .setColor(0xEE7100)
            .setURL(`https://swgoh.gg/g/${guildNum}/${guildInfo[3]}/`);

        embed.addField("Guild Report", playerProgressMessages.join("\n"), false);
        await guildMessage.edit("Here's what I found:");
        await message.channel.send({ embed });

    } catch (error) {
        client.errlog(cmd, message, level, error);
        client.logger.error(client, `guildscreen command failure:\n${error.stack}`);
        client.codeError(message);
    }

};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ["gst"],
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
