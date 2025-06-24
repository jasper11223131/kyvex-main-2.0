const { EmbedBuilder } = require("discord.js");
const emojis = require("../emojis.js"); // Make sure this path is correct based on your setup
const config = require("../config.js"); // Import config for embed color

// This array will hold your bot's update information.
// Add new updates to the top of this array so the latest is always shown first.
const botUpdates = [
    {
        version: "1.0.1",
        date: "June 24, 2025", // Current date
        changes: [
            "Added the **`updates`** command to show recent bot changes and a changelog.",
            "Improved error messages for various music commands for better user feedback.",
            "Minor performance optimizations for smoother queue management and playback."
        ]
    },
    {
        version: "1.0.0",
        date: "June 20, 2025",
        changes: [
            "Initial release of the music bot.",
            "Core music playback functionalities: `play`, `pause`, `resume`, `skip`, `stop`.",
            "Comprehensive queue management: `queue`, `shuffle`, `loop`, `remove`, `clear`.",
            "Volume adjustment (`volume`) and current track display (`nowplaying`).",
            "Seamless integration with YouTube and Spotify via Riffy."
        ]
    }
];

function sendUpdates(channel) {
    if (botUpdates.length === 0) {
        return channel.send({ content: `${emojis.error} | Sorry, no updates are available yet!` });
    }

    const embed = new EmbedBuilder()
        .setColor(config.embedColor || "#0099ff") // Use embedColor from config or a default blue
        .setTitle("<:Update:1387100783492989111> Bot Updates & Changelog")
        .setDescription("Here are the latest changes and improvements to the bot:")
        .setTimestamp()
        .setFooter({ text: "Bot Updates" });

    // Add each update as a field in the embed
    botUpdates.forEach(update => {
        const changesList = update.changes.map(change => `- ${change}`).join("\n");
        embed.addFields(
            { name: `Version ${update.version} (${update.date})`, value: changesList }
        );
    });

    channel.send({ embeds: [embed] });
}

module.exports = {
    sendUpdates
};
