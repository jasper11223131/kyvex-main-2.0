// utils/logger.js
const { EmbedBuilder } = require('discord.js');
const config = require('../config.js'); // Assuming config.js is one level up
const emojis = require('../emojis.js'); // Assuming emojis.js is one level up

let clientInstance; // To store the client object

module.exports = {
    /**
     * Initializes the logger with the Discord client instance.
     * Call this once when your bot is ready.
     * @param {Client} client The Discord.js Client instance.
     */
    init: (client) => {
        clientInstance = client;
    },

    /**
     * Sends a log message to the designated log channel.
     * @param {string} title The title of the log embed.
     * @param {string} description The main content/description of the log.
     * @param {string} [color='#0099ff'] The color of the embed (hex code).
     * @param {object[]} [fields=[]] An array of field objects { name, value, inline }.
     */
    log: (title, description, color = config.embedColor || '#0099ff', fields = []) => {
        if (!clientInstance) {
            console.error("Logger not initialized! Call logger.init(client) in index.js on bot ready.");
            return;
        }
        if (!config.logChannelId) {
            console.warn("Log channel ID not configured in config.js. Skipping logging.");
            return;
        }

        const logChannel = clientInstance.channels.cache.get(config.logChannelId);
        if (!logChannel) {
            console.error(`Log channel with ID ${config.logChannelId} not found!`);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: 'Bot Log' });

        if (fields.length > 0) {
            embed.addFields(fields);
        }

        logChannel.send({ embeds: [embed] }).catch(err => {
            console.error(`Failed to send log to channel ${config.logChannelId}: ${err.message}`);
        });
    },

    // --- Specific Log Functions ---

    commandUsed: (commandName, message) => {
        module.exports.log(
            `${emojis.info} Command Used`,
            `**Command:** \`${config.prefix}${commandName}\`\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Channel:** ${message.channel.name} (\`${message.channel.id}\`)\n**Server:** ${message.guild ? message.guild.name : 'Direct Message'} (\`${message.guild ? message.guild.id : 'DM'}\`)`,
            '#3498db' // Blue color
        );
    },

    guildJoin: (guild) => {
        module.exports.log(
            `${emojis.success} Joined Server`,
            `**Server Name:** ${guild.name}\n**Server ID:** \`${guild.id}\`\n**Members:** ${guild.memberCount}\n**Owner:** ${guild.ownerId ? `<@${guild.ownerId}>` : 'Unknown'}`,
            '#2ecc71' // Green color
        );
    },

    guildLeave: (guild) => {
        module.exports.log(
            `${emojis.error} Left Server`,
            `**Server Name:** ${guild.name}\n**Server ID:** \`${guild.id}\`\n**Members:** ${guild.memberCount}`,
            '#e74c3c' // Red color
        );
    },

    playerEvent: (eventName, player, track = null) => {
        let description = `Player Event: **${eventName}**\n**Guild:** ${player.guildId}`;
        if (track) {
            description += `\n**Track:** [${track.info.title}](${track.info.uri})`;
        }
        module.exports.log(
            `${emojis.music} Music Player Event`,
            description,
            '#f1c40f' // Yellow color
        );
    },

    nodeStatus: (nodeName, status) => {
        module.exports.log(
            `${emojis.info} Node Status`,
            `Node **${nodeName}** is now **${status}**`,
            status === 'connected' ? '#2ecc71' : '#e74c3c'
        );
    },

    error: (source, error) => {
        module.exports.log(
            `${emojis.error} Error Occurred`,
            `**Source:** ${source}\n**Message:** ${error.message}\n\`\`\`${error.stack || 'No stack trace'}\`\`\``,
            '#e74c3c'
        );
    }
};
