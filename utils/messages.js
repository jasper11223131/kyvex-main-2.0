const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js'); // Add Button imports
const path = require('path');
const emojis = require('../emojis.js');

// Temporarily try to load config using an absolute path for debugging
let config;
try {
    const configPath = path.resolve(__dirname, '../../config.js');
    config = require(configPath);
    // console.log(`[DEBUG] Config loaded from absolute path: ${configPath}`); // Keep for debugging if needed
} catch (error) {
    // console.error(`[DEBUG] Failed to load config from absolute path:`, error); // Keep for debugging if needed
    config = require('../config.js');
}

function formatDuration(ms) {
    if (typeof ms !== 'number' || isNaN(ms) || ms <= 0) {
        return '00:00';
    }

    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    let parts = [];
    if (days > 0) parts.push(`${days} days`);
    if (hours > 0) parts.push(`${hours} hours`);
    if (minutes > 0) parts.push(`${minutes} minutes`);
    if (seconds > 0) parts.push(`${seconds} seconds`);

    if (parts.length === 0) return '0 seconds';

    return parts.join(', ');
}

function getDurationString(track) {
    if (track.info.isStream) return 'LIVE';
    const durationMs = track.info.duration || track.info.length;
    return formatDuration(durationMs);
}

module.exports = {
    success: (channel, message) => {
        return channel.send(`${emojis.success} | ${message}`).catch(console.error);
    },

    error: (channel, message) => {
        return channel.send(`${emojis.error} | ${message}`).catch(console.error);
    },

    // Modified nowPlaying to accept player object and return components
    nowPlaying: async (channel, track, player) => { // Added 'player' parameter
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.music} Now Playing`)
            .setDescription(`**[${track.info.title}](${track.info.uri})**`);

        if (track.info.thumbnail && typeof track.info.thumbnail === 'string') {
            embed.setThumbnail(track.info.thumbnail);
        }

        embed.addFields([
            { name: 'Artist', value: `${emojis.info} ${track.info.author}`, inline: true },
            { name: 'Duration', value: `${emojis.time} ${getDurationString(track)}`, inline: true },
            { name: 'Requested By', value: `${emojis.info} ${track.info.requester.tag}`, inline: true }
        ])
        .setFooter({ text: `Requested by ${track.info.requester.tag}`, iconURL: track.info.requester.displayAvatarURL() || null })
        .setTimestamp();

        // --- Create Buttons ---
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_toggle_play_pause')
                    .setLabel(player && player.paused ? 'Resume' : 'Pause') // Dynamic label
                    .setStyle(player && player.paused ? ButtonStyle.Success : ButtonStyle.Primary) // Dynamic style
                    .setEmoji(player && player.paused ? emojis.play : emojis.pause), // Dynamic emoji using emojis object
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setLabel('Skip')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.skip), // Using emojis object
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setLabel('Stop')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(emojis.stop), // Using emojis object
                new ButtonBuilder() // Optional: Loop button
                    .setCustomId('music_loop_toggle')
                    .setLabel('Loop')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.loop), // Using emojis object
                new ButtonBuilder() // Optional: Queue button
                    .setCustomId('music_show_queue')
                    .setLabel('Queue')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis.queue), // Using emojis object
            );

        try {
            // Send embed with components
            const sentMessage = await channel.send({ embeds: [embed], components: [row] });
            return sentMessage;
        } catch (error) {
            console.error(`Failed to send now playing message with buttons:`, error);
            return null;
        }
    },

    addedToQueue: async (channel, track, position) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emojis.success} Added to queue: **[${track.info.title}](${track.info.uri})**`);

        if (track.info.thumbnail && typeof track.info.thumbnail === 'string') {
            embed.setThumbnail(track.info.thumbnail);
        }

        embed.addFields([
            { name: 'Artist', value: `${emojis.info} ${track.info.author}`, inline: true },
            { name: 'Duration', value: `${emojis.time} ${getDurationString(track)}`, inline: true },
            { name: 'Position', value: `${emojis.queue1} #${position}`, inline: true }
        ])
        .setFooter({ text: `Requested by ${track.info.requester.tag}`, iconURL: track.info.requester.displayAvatarURL() || null })
        .setTimestamp();

        try {
            const sentMessage = await channel.send({ embeds: [embed] });
            return sentMessage;
        } catch (error) {
            console.error(`Failed to send added to queue message:`, error);
            return null;
        }
    },

    addedPlaylist: async (channel, playlistInfo, tracks) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.success} Added Playlist`)
            .setDescription(`**[${playlistInfo.name}](${playlistInfo.uri || 'No URL'})**`);

        const totalDuration = tracks.reduce((acc, track) => {
            const trackDuration = track.info.duration || track.info.length;
            if (!track.info.isStream && typeof trackDuration === 'number' && trackDuration > 0) {
                return acc + trackDuration;
            }
            return acc;
        }, 0);
        const streamCount = tracks.filter(t => t.info.isStream).length;

        embed.addFields([
            { name: 'Total Tracks', value: `${emojis.queue} ${tracks.length} tracks`, inline: true }
        ]);

        if (totalDuration > 0) {
            embed.addFields({ name: 'Estimated Duration', value: `${emojis.time} ${formatDuration(totalDuration)}`, inline: true });
        }
        if (streamCount > 0) {
            embed.addFields({ name: 'Streams Included', value: `${emojis.info} ${streamCount}`, inline: true });
        }

        // Modified logic to ensure thumbnail is a string before setting
        if (playlistInfo.thumbnail && typeof playlistInfo.thumbnail === 'string') {
            embed.setThumbnail(playlistInfo.thumbnail);
        } else if (tracks.length > 0 && tracks[0].info.thumbnail && typeof tracks[0].info.thumbnail === 'string') {
            embed.setThumbnail(tracks[0].info.thumbnail);
        }

        embed.setFooter({ text: 'The playlist will start playing soon' })
        .setTimestamp();

        try {
            const sentMessage = await channel.send({ embeds: [embed] });
            return sentMessage;
        } catch (error) {
            console.error(`Failed to send added playlist message:`, error);
            return null;
        }
    },

    queueEnded: (channel) => {
        return channel.send(`${emojis.info} | Queue has ended. Leaving voice channel.`).catch(console.error);
    },

    queueList: (channel, queue, currentTrack, currentPage = 1, totalPages = 1) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.queue} Music Queue`)
            .setTimestamp();

        if (currentTrack) {
            embed.setDescription(
                `**${emojis.play} Now Playing:** [${currentTrack.info.title}](${currentTrack.info.uri}) - \`${getDurationString(currentTrack)}\`\n\n**Up Next:**`
            );
            if (currentTrack.info.thumbnail && typeof currentTrack.info.thumbnail === 'string') {
                embed.setThumbnail(currentTrack.info.thumbnail);
            }
        } else {
            embed.setDescription("**Queue is empty!** Add some tracks with the play command.");
        }

        if (queue.length > 0) {
            const tracksList = queue.map((track, i) =>
                `\`${String(i + 1).padStart(2, '0')}\` ${emojis.song} [${track.info.title}](${track.info.uri}) - \`${getDurationString(track)}\``
            ).join('\n');
            embed.addFields({ name: '\u200B', value: tracksList });
        } else if (!currentTrack) {
            embed.setDescription("**Queue is empty!** Add some tracks with the play command.");
        }

        if (queue.length > 0) {
            embed.setFooter({ text: `Page ${currentPage}/${totalPages} | Total Tracks: ${queue.length + (currentTrack ? 1 : 0)}` });
        }

        return channel.send({ embeds: [embed] }).catch(console.error);
    },

    playerStatus: (channel, player) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.info} Player Status`)
            .addFields([
                { name: 'Status', value: player.playing ? `${emojis.play} Playing` : (player.paused ? `${emojis.pause} Paused` : `${emojis.stop} Stopped`), inline: true },
                { name: 'Volume', value: `${emojis.volume} ${player.volume}%`, inline: true },
                { name: 'Loop Mode', value: `${emojis.repeat} ${player.loop.charAt(0).toUpperCase() + player.loop.slice(1)}`, inline: true },
                { name: 'Queue Size', value: `${emojis.queue} ${player.queue.length} tracks`, inline: true },
            ])
            .setTimestamp();

        if (player.queue.current) {
            embed.addFields({ name: 'Current Track', value: `[${player.queue.current.info.title}](${player.queue.current.info.uri})`, inline: false });
        }

        return channel.send({ embeds: [embed] }).catch(console.error);
    },

    ping: (channel, discordPing, botPing, nodeLatencies) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.info} Pong!`)
            .setDescription('Here are my latencies:')
            .addFields(
                { name: 'Discord API Latency', value: `${emojis.discord} \`${Math.round(discordPing)}ms\``, inline: true },
                { name: 'Bot Latency', value: `${emojis.info} \`${Math.round(botPing)}ms\``, inline: true },
            )
            .setTimestamp();

        if (Object.keys(nodeLatencies).length > 0) {
            let nodeField = '';
            for (const nodeName in nodeLatencies) {
                nodeField += `\n${emojis.music} \`${nodeName}\`: \`${Math.round(nodeLatencies[nodeName])}ms\``;
            }
            embed.addFields({ name: 'Riffy Node Latencies', value: nodeField, inline: false });
        } else {
            embed.addFields({ name: 'Riffy Node Latencies', value: `${emojis.warning} No active Riffy nodes found.`, inline: false });
        }

        return channel.send({ embeds: [embed] }).catch(console.error);
    },

    uptime: (channel, uptimeMs) => {
        const formattedUptime = formatDuration(uptimeMs);
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.info} Bot Uptime`)
            .setDescription(`I have been online for: \`${formattedUptime}\``)
            .setTimestamp();

        return channel.send({ embeds: [embed] }).catch(console.error);
    },

    help: (channel, commands, prefix) => {
        const musicCommands = commands.filter(cmd => ![
            'updates', 'prefix', 'help', 'ping', 'uptime', 'setactivity'
        ].includes(cmd.name.split(' ')[0]));

        const utilityCommands = commands.filter(cmd => [
            'updates', 'prefix', 'help', 'ping', 'uptime', 'setactivity'
        ].includes(cmd.name.split(' ')[0]));

        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.info} Kyvex Music Bot Commands`)
            .setDescription(`My current prefix for this server is: \`${prefix}\`\n\nTo use a command, type \`${prefix}<command>\`\n\n`);

        if (musicCommands.length > 0) {
            const musicField = musicCommands.map(cmd => `\`${prefix}${cmd.name}\`: ${cmd.description}`).join('\n');
            embed.addFields({ name: '🎶 Music Commands', value: musicField, inline: false });
        }

        if (utilityCommands.length > 0) {
            const utilityField = utilityCommands.map(cmd => `\`${prefix}${cmd.name}\`: ${cmd.description}`).join('\n');
            embed.addFields({ name: '🛠️ Utility Commands', value: utilityField, inline: false });
        }

        embed.setFooter({ text: `Requested by ${channel.guild.name}` })
             .setTimestamp();

        return channel.send({ embeds: [embed] }).catch(console.error);
    },
};
