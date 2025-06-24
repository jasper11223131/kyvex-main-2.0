const { EmbedBuilder } = require('discord.js');
const emojis = require('../emojis.js'); // Make sure your emojis.js path is correct
const config = require('../config.js'); // Make sure your config.js path is correct

/**
 * Formats duration from milliseconds to HH:MM:SS or MM:SS.
 * @param {number} ms The duration in milliseconds.
 * @returns {string} Formatted duration string or 'LIVE'.
 */
function formatDuration(ms) {
    // Return 'LIVE' for invalid or zero durations (streams)
    if (!ms || ms <= 0 || ms === 'Infinity') return 'LIVE';

    // Convert to seconds
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    // Format based on length (pad with '0' for single digits)
    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Gets the duration string for a track, handling streams.
 * @param {Object} track The track object from Riffy.
 * @returns {string} Formatted duration or 'LIVE'.
 */
function getDurationString(track) {
    if (track.info.isStream) return 'LIVE';
    if (!track.info.duration) return 'N/A'; // Fallback if duration is missing
    return formatDuration(track.info.duration);
}

module.exports = {
    /**
     * Sends a simple success message.
     * @param {TextChannel} channel The channel to send the message in.
     * @param {string} message The success message content.
     */
    success: (channel, message) => {
        return channel.send(`${emojis.success} | ${message}`).catch(console.error);
    },

    /**
     * Sends a simple error message.
     * @param {TextChannel} channel The channel to send the message in.
     * @param {string} message The error message content.
     */
    error: (channel, message) => {
        return channel.send(`${emojis.error} | ${message}`).catch(console.error);
    },

    /**
     * Sends an embed message for the currently playing track.
     * @param {TextChannel} channel The channel to send the message in.
     * @param {Object} track The track object from Riffy.
     */
    nowPlaying: (channel, track) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.music} Now Playing`)
            .setDescription(`**[${track.info.title}](${track.info.uri})**`); // Make title bold

        if (track.info.thumbnail && typeof track.info.thumbnail === 'string') {
            embed.setThumbnail(track.info.thumbnail);
        }

        embed.addFields([
            { name: 'Artist', value: `${emojis.info} ${track.info.author}`, inline: true },
            { name: 'Duration', value: `${emojis.time} ${getDurationString(track)}`, inline: true },
            { name: 'Requested By', value: `${emojis.info} ${track.info.requester.tag}`, inline: true }
        ])
        .setFooter({ text: `Requested by ${track.info.requester.tag}`, iconURL: track.info.requester.displayAvatarURL() || null }) // Add requester to footer
        .setTimestamp(); // Add timestamp for better info

        return channel.send({ embeds: [embed] }).catch(console.error);
    },

    /**
     * Sends an embed message when a track is added to the queue.
     * @param {TextChannel} channel The channel to send the message in.
     * @param {Object} track The track object from Riffy.
     * @param {number} position The position of the track in the queue.
     */
    addedToQueue: (channel, track, position) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`${emojis.success} Added to queue: **[${track.info.title}](${track.info.uri})**`); // Make title bold

        if (track.info.thumbnail && typeof track.info.thumbnail === 'string') {
            embed.setThumbnail(track.info.thumbnail);
        }

        embed.addFields([
            { name: 'Artist', value: `${emojis.info} ${track.info.author}`, inline: true },
            { name: 'Duration', value: `${emojis.time} ${getDurationString(track)}`, inline: true },
            { name: 'Position', value: `${emojis.queue} #${position}`, inline: true }
        ])
        .setFooter({ text: `Requested by ${track.info.requester.tag}`, iconURL: track.info.requester.displayAvatarURL() || null }) // Add requester to footer
        .setTimestamp(); // Add timestamp for better info

        return channel.send({ embeds: [embed] }).catch(console.error);
    },

    /**
     * Sends an embed message when a playlist is added to the queue.
     * @param {TextChannel} channel The channel to send the message in.
     * @param {Object} playlistInfo The playlist info object from Riffy.
     * @param {Array<Object>} tracks The array of tracks in the playlist.
     */
    addedPlaylist: (channel, playlistInfo, tracks) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.success} Added Playlist`)
            .setDescription(`**[${playlistInfo.name}](${playlistInfo.uri || 'No URL'})**`); // Make title bold, add URL if available

        // Calculate total duration excluding streams
        const totalDuration = tracks.reduce((acc, track) => {
            if (!track.info.isStream && track.info.duration) {
                return acc + track.info.duration;
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

        if (playlistInfo.thumbnail && typeof playlistInfo.thumbnail === 'string') {
            embed.setThumbnail(playlistInfo.thumbnail);
        } else if (tracks.length > 0 && tracks[0].info.thumbnail) { // Fallback to first track's thumbnail
            embed.setThumbnail(tracks[0].info.thumbnail);
        }

        embed.setFooter({ text: 'The playlist will start playing soon' })
        .setTimestamp(); // Add timestamp for better info

        return channel.send({ embeds: [embed] }).catch(console.error);
    },

    /**
     * Sends a message indicating the queue has ended.
     * @param {TextChannel} channel The channel to send the message in.
     */
    queueEnded: (channel) => {
        return channel.send(`${emojis.info} | Queue has ended. Leaving voice channel.`).catch(console.error);
    },

    /**
     * Sends an embed message with the current queue list.
     * @param {TextChannel} channel The channel to send the message in.
     * @param {Array<Object>} queue The Riffy queue array.
     * @param {Object} currentTrack The currently playing track.
     * @param {number} currentPage The current page number (default to 1).
     * @param {number} totalPages The total number of pages (default to 1).
     */
    queueList: (channel, queue, currentTrack, currentPage = 1, totalPages = 1) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.queue} Music Queue`)
            .setTimestamp(); // Add timestamp for better info

        // Display currently playing track
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

        // List upcoming tracks
        if (queue.length > 0) {
            const tracksList = queue.map((track, i) =>
                `\`${String(i + 1).padStart(2, '0')}\` ${emojis.song} [${track.info.title}](${track.info.uri}) - \`${getDurationString(track)}\``
            ).join('\n');
            embed.addFields({ name: '\u200b', value: tracksList.substring(0, 1024) }); // Truncate if too long
        } else if (!currentTrack) { // Only if nothing is playing and queue is empty
             embed.addFields({ name: '\u200b', value: 'No tracks in queue.' });
        }

        // Calculate total duration for queue (excluding streams)
        const queueTotalDuration = queue.reduce((acc, track) => {
            if (!track.info.isStream && track.info.duration) {
                return acc + track.info.duration;
            }
            return acc;
        }, 0);
        const queueStreamCount = queue.filter(t => t.info.isStream).length;

        let footerText = `Total Tracks in Queue: ${queue.length}`;
        if (queueTotalDuration > 0) {
            footerText += ` • Est. Queue Duration: ${formatDuration(queueTotalDuration)}`;
        }
        if (queueStreamCount > 0) {
            footerText += ` (${queueStreamCount} streams)`;
        }
        footerText += ` • Page ${currentPage}/${totalPages}`;

        embed.setFooter({ text: footerText });

        return channel.send({ embeds: [embed] }).catch(console.error);
    },

    /**
     * Sends an embed message with the current player status.
     * @param {TextChannel} channel The channel to send the message in.
     * @param {Player} player The Riffy player object.
     */
    playerStatus: (channel, player) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.info} Player Status`)
            .addFields([
                {
                    name: 'Status',
                    value: player.paused ? `${emojis.pause} Paused` : `${emojis.play} Playing`,
                    inline: true
                },
                {
                    name: 'Volume',
                    value: `${emojis.volume} ${player.volume}%`,
                    inline: true
                },
                {
                    name: 'Loop Mode',
                    value: `${emojis.repeat} ${player.loop === "queue" ? 'Queue' : 'Disabled'}`,
                    inline: true
                }
            ])
            .setTimestamp(); // Add timestamp for better info

        if (player.voiceChannel) {
            embed.addFields({ name: 'Voice Channel', value: `<#${player.voiceChannel}>`, inline: true });
        }
        if (player.queue.current) {
            const track = player.queue.current;
            embed.setDescription(
                `**Currently Playing:**\n**[${track.info.title}](${track.info.uri})**\n` +
                `${emojis.time} Duration: \`${formatDuration(player.position)}\` / \`${getDurationString(track)}\``
            );

            if (track.info.thumbnail && typeof track.info.thumbnail === 'string') {
                embed.setThumbnail(track.info.thumbnail);
            }
        } else {
            embed.setDescription('No track is currently playing.');
        }

        return channel.send({ embeds: [embed] }).catch(console.error);
    },

    /**
     * Sends a help message listing all available commands, matching the provided screenshot.
     * @param {TextChannel} channel The channel to send the message in.
     * @param {Array<Object>} commands An array of command objects { name, description }.
     * @param {string} currentPrefix The actual prefix for the current guild.
     */
    help: (channel, commands, currentPrefix) => {
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${emojis.info} Available Commands`)
            .setTimestamp(); // Matches the screenshot's time display

        // Sort commands alphabetically by name
        commands.sort((a, b) => a.name.localeCompare(b.name));

        const commandList = commands.map(cmd => {
            // Check if cmd.description exists, otherwise use a default or empty string
            const description = cmd.description ? cmd.description : 'No description provided.';
            return `${emojis.music} \`${currentPrefix}${cmd.name}\` - ${description}`;
        }).join('\n');

        embed.setDescription(commandList);

        // Add the prefix and example line to the footer
        embed.setFooter({
            text: `Prefix: ${currentPrefix} • Example: ${currentPrefix}play <song name>`
        });

        return channel.send({ embeds: [embed] }).catch(console.error);
    }
};
