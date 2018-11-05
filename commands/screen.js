const { RichEmbed } = require("discord.js");
const rosterAnalyzer = require("./../modules/roster-analyzer.js");

exports.run = async (client, message, cmd, args, level) => { // eslint-disable-line no-unused-vars

    try {
        // Pull in our swgoh databases
        const charactersData = client.swgohData.get("charactersData");
        const shipsData = client.swgohData.get("shipsData");

        const [id, searchText, error] = await client.profileCheck(message, args); // eslint-disable-line no-unused-vars
        if (!id) return await message.reply(error).then(client.cmdError(message, cmd));

        const guildMessage = await message.channel.send("Checking... One moment. 👀");

        let profile = client.cache.get(id + "_profile");
        // Only cache if needed to
        if (!profile || (profile && !profile.userId)) {
            try {
                await client.cacheCheck(message, id, "cs");
                profile = client.cache.get(id + "_profile");
            } catch (error) {
                client.errlog(cmd, message, level, error);
                client.logger.error(client, `swgoh.gg profile pull failure within the guild command:\n${error.stack}`);
            }
        } else await client.cacheCheck(message, id, "cs");
        if (!profile || (profile && !profile.userId)) return await guildMessage.edit("I can't find a profile for that username").then(client.cmdError(message, cmd));

        const characterCollection = client.cache.get(id + "_collection");
        const shipCollection = client.cache.get(id + "_ships");

        const allyCodeDisplay = profile.allyCode ? ` (${profile.allyCode})` : "";

        // Creating the embed
        const embed = new RichEmbed()
            .setColor(0xEE7100)
            .setTitle(`${profile.username}'s${allyCodeDisplay} Key Units Report`)
            .setURL(`https://swgoh.gg/p/${id}/characters/`);

        const rosterStatus = rosterAnalyzer(characterCollection, shipCollection, charactersData, shipsData);

        const deficientChars = rosterStatus.characterStatus.deficientUnits;
        const deficientShips = rosterStatus.shipStatus.deficientUnits;

        const naUnits = rosterStatus.characterStatus.inactiveUnits.concat(rosterStatus.shipStatus.inactiveUnits);

        const progress = rosterStatus.totalProgress;

        const charMessage = deficientChars.length ? deficientChars.join("\n") : "None!";
        const shipMessage = deficientShips.length ? deficientShips.join("\n") : "None!";
        const naMessage = naUnits.length ? naUnits.join("\n") : "None!";

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
