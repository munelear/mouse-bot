const { RichEmbed } = require("discord.js");
const fuzzy = require("fuzzy-predicate");
const requiredCharacters = require("./../modules/common-characters.js");
const requiredShips = require("./../modules/common-ships.js");

const shardsRemainingAtStarLevel = {
    0: 330,
    1: 320,
    2: 305,
    3: 280,
    4: 250,
    5: 185,
    6: 100,
    7: 0
};

exports.run = async (client, message, cmd, args, level) => { // eslint-disable-line no-unused-vars

    try {
        // Pull in our swgoh databases
        const charactersData = client.swgohData.get("charactersData");
        const shipsData = client.swgohData.get("shipsData");

        const [id, searchText, error] = await client.profileCheck(message, args); // eslint-disable-line no-unused-vars
        if (id === undefined) return await message.reply(error).then(client.cmdError(message, cmd));

        const guildMessage = await message.channel.send("Checking... One moment. 👀");

        let profile = client.cache.get(id + "_profile");
        // Only cache if needed to
        if (profile === undefined || profile.userId === undefined) {
            try {
                await client.cacheCheck(message, id, "cs");
                profile = client.cache.get(id + "_profile");
            } catch (error) {
                client.errlog(cmd, message, level, error);
                client.logger.error(client, `swgoh.gg profile pull failure within the guild command:\n${error.stack}`);
            }
        } else await client.cacheCheck(message, id, "cs");
        if (profile === undefined || profile.userId === undefined) return await guildMessage.edit("I can't find a profile for that username").then(client.cmdError(message, cmd));

        const characterCollection = client.cache.get(id + "_collection");
        const shipCollection = client.cache.get(id + "_ships");

        const allyCodeDisplay = profile.allyCode ? ` (${profile.allyCode})` : "";

        // Creating the embed
        const embed = new RichEmbed()
            .setColor(0xEE7100)
            .setTitle(`${profile.username}'s${allyCodeDisplay} Key Units Report`)
            .setURL(`https://swgoh.gg/u/${encodeURI(id)}/collection/`);

        const missingCharacters = [];
        let totalAcquiredShards = 0;
        let totalRequiredShards = 0;

        const notActivated = [];
        requiredCharacters.forEach(character => {
            const lookup = charactersData.filter(fuzzy(character.name, ["name", "nickname"]));
            if (!lookup) console.log("I couldn't find: " + character.name);
            if (lookup.length > 1) console.log("I found too many matches for: " + character.name);

            const foundCharacter = characterCollection.find(c => c.description === lookup[0].name);
            const rank = (foundCharacter) ? Number(foundCharacter.star) : 0;

            if (rank < character.stars) {
                totalRequiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[character.stars];
                totalAcquiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[rank];
                if (foundCharacter && rank) {
                    missingCharacters.push(`${foundCharacter.star}* ${foundCharacter.level}-g${foundCharacter.gearLevel} (${foundCharacter.galacticPower}) - ${foundCharacter.description}`);
                } else {
                    notActivated.push(`n.a. - ${lookup[0].name}`);
                }
            } else {
                // so we don't get % completions over 100, cap the acquired at the required level
                totalRequiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[character.stars];
                totalAcquiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[character.stars];
            }
        });

        const missingShips = [];
        requiredShips.forEach(ship => {
            const lookup = shipsData.filter(fuzzy(ship.name, ["name", "nickname"]));
            if (!lookup) console.log("I couldn't find: " + ship.name);
            if (lookup.length > 1) console.log("I found too many matches for: " + ship.name);

            const foundCharacter = shipCollection.find(c => c.description === lookup[0].name);
            const rank = (foundCharacter) ? Number(foundCharacter.star) : 0;

            if (rank < ship.stars) {
                totalRequiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[ship.stars];
                totalAcquiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[rank];
                if (foundCharacter && rank) {
                    missingShips.push(`${foundCharacter.star}* ${foundCharacter.level} (${foundCharacter.galacticPower}) - ${foundCharacter.description}`);
                } else {
                    notActivated.push(`n.a. - ${lookup[0].name}`);
                }
            } else {
                // so we don't get % completions over 100, cap the acquired at the required level
                totalRequiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[ship.stars];
                totalAcquiredShards += shardsRemainingAtStarLevel[0] - shardsRemainingAtStarLevel[ship.stars];
            }
        });

        const charMessage = missingCharacters.length ? missingCharacters.join("\n") : "None!";
        const shipMessage = missingShips.length ? missingShips.join("\n") : "None!";
        const naMessage = notActivated.length ? notActivated.join("\n") : "None!";

        const progress = ((totalAcquiredShards / totalRequiredShards) * 100).toFixed(1);
        embed.setDescription(`\`~${progress}% complete\``);
        embed.addField("Deficient Characters", charMessage, false);
        embed.addField("Deficient Ships", shipMessage, false);
        embed.addField("Not Activated", naMessage, false);

        await guildMessage.edit("Here's what I found:");
        await message.channel.send({ embed });
    } catch (error) {
        client.errlog(cmd, message, level, error);
        client.logger.error(client, `screen command failure:\n${error.stack}`);
        client.codeError(message);
    }

};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: [],
    arguments: ["user mention", "1-7"],
    permLevel: "User"
};

exports.help = {
    name: "screen",
    category: "Game",
    description: "Looks up an individual profile and returns a report of 'required' character statuses",
    usage: "screen [profile url]",
    examples: ["screen https://swgoh.gg/u/necavit"]
};
