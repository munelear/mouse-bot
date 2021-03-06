exports.run = async (client, message, cmd, args, level) => { // eslint-disable-line no-unused-vars

    try {

        const closeMessage = await message.channel.send("Strike me down, and I will become more powerful than you could possibly imagine!");
        client.commands.forEach( async cmd => {
            await client.unloadCommand(cmd);
        });

        // Close the collections before shutting down
        await client.pointsTable.db.close();
        await client.cache.db.close();

        await closeMessage.edit(`Only at the end do you realize the power of the Dark Side.
*<RRRRDDTT!!!! Wewewedt! Veeeeedt!>*`);

        if (message.content.includes("shutdown")) {
            const { exec } = require("child_process");
            exec("pm2 stop mousebot", (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    return;
                }
                console.log(`stdout: ${stdout}`);
                console.log(`stderr: ${stderr}`);
            });
        } else {
            await message.channel.send("[Please wait 30 seconds before you feed me anymore of your commands]");
            process.exit(1);
        }

    } catch (error) {
        client.errlog(cmd, message, level, error);
        client.logger.error(client, `restart command failure:\n${error.stack}`);
        client.codeError(message);
    }
};

exports.conf = {
    enabled: true,
    guildOnly: false,
    aliases: ["reboot", "shutdown"],
    arguments: [],
    permLevel: "Bot Admin"
};

exports.help = {
    name: "restart",
    category: "System",
    description: "Shuts down the bot and might restart",
    usage: "restart",
    examples: ["restart", "reboot"]
};
