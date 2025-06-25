const { Client, GatewayDispatchEvents, ActivityType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js"); // Added Button imports
const { Riffy } = require("riffy");
const { Spotify } = require("riffy-spotify");
const config = require("./config.js");
const messages = require("./utils/messages.js");
const emojis = require("./emojis.js");
const updates = require("./utils/updates.js");
const logger = require("./utils/logger.js");
const prefixManager = require("./utils/prefixManager.js");

const client = new Client({
    intents: [
        "Guilds",
        "GuildMessages",
        "GuildVoiceStates",
        "GuildMessageReactions",
        "MessageContent",
        "DirectMessages",
    ],
});

const spotify = new Spotify({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret
});

client.riffy = new Riffy(client, config.nodes, {
    send: (payload) => {
        const guild = client.guilds.cache.get(payload.d.guild_id);
        if (guild) guild.shard.send(payload);
    },
    defaultSearchPlatform: "ytmsearch",
    restVersion: "v4",
    plugins: [spotify]
});

// Command definitions for help command
const commands = [
    { name: 'play <query>', description: 'Play a song or playlist' },
    { name: 'pause', description: 'Pause the current track' },
    { name: 'resume', description: 'Resume the current track' },
    { name: 'skip', description: 'Skip the current track' },
    { name: 'stop', description: 'Stop playback and clear queue' },
    { name: 'queue', description: 'Show the current queue' },
    { name: 'nowplaying', description: 'Show current track info' },
    { name: 'volume <0-100>', description: 'Adjust player volume' },
    { name: 'shuffle', description: 'Shuffle the current queue' },
    { name: 'loop', description: 'Toggle queue loop mode' },
    { name: 'remove <position>', description: 'Remove a track from queue' },
    { name: 'clear', description: 'Clear the current queue' },
    { name: 'status', description: 'Show player status' },
    { name: 'updates', description: 'Show the latest bot updates and changelog' },
    { name: 'prefix <new_prefix>', description: 'Change the bot\'s command prefix for this server (Admin only).' },
    { name: 'ping', description: 'Check the bot\'s latency to Discord and Riffy nodes.' },
    { name: 'uptime', description: 'Show how long the bot has been online.' },
    { name: 'help', description: 'Show this help message' }
];

// Maps to store the last sent message IDs for different types, per guild
const lastActiveNowPlayingMessage = new Map(); // Stores the last sent "Now Playing" embed
const addedToQueueMessages = new Map();     // Stores an array of all "Added to queue" or "Added Playlist" embeds

/**
 * Helper function to safely delete a message.
 * @param {Message|null} message The Discord message object to delete.
 */
async function safeDeleteMessage(message) {
    if (message && !message.deleted) {
        try {
            await message.delete();
        } catch (error) {
            // Ignore if message is already deleted or permissions are missing
            if (error.code !== 10008) { // Unknown Message error (10008) means it's already gone
                console.error(`Failed to delete message: ${error.message}`);
            }
        }
    }
}


client.on("ready", () => {
    client.riffy.init(client.user.id);
    console.log(`${emojis.success} Logged in as ${client.user.tag}`);

    logger.init(client);
    prefixManager.loadPrefixes();

    logger.log(
        `${emojis.success} Bot Started`,
        `Logged in as **${client.user.tag}** (\`${client.user.id}\`)\nCurrently in **${client.guilds.cache.size}** servers.`,
        '#2ecc71'
    );

    client.user.setActivity('Kyvex Music', { type: ActivityType.Streaming, url: 'https://www.twitch.tv/kyvexmusic' });
    console.log(`${emojis.info} Bot activity set to: Streaming Kyvex Music (https://www.twitch.tv/kyvexmusic)`);
});

client.on('guildCreate', (guild) => {
    logger.guildJoin(guild);
});

client.on('guildDelete', (guild) => {
    logger.guildLeave(guild);
    // Clean up messages from maps when bot leaves a guild
    lastActiveNowPlayingMessage.delete(guild.id);
    addedToQueueMessages.delete(guild.id);
});


client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const guildPrefix = message.guild ? prefixManager.getPrefix(message.guild.id) : config.prefix;

    if (!message.content.startsWith(guildPrefix)) return;

    const args = message.content.slice(guildPrefix.length).trim().split(" ");
    const command = args.shift().toLowerCase();

    logger.commandUsed(command, message);

    const musicCommands = ["play", "skip", "stop", "pause", "resume", "queue", "nowplaying", "volume", "shuffle", "loop", "remove", "clear"];
    if (musicCommands.includes(command)) {
        if (!message.member.voice.channel) {
            return messages.error(message.channel, "You must be in a voice channel!");
        }
    }

    switch (command) {
        case "help": {
            messages.help(message.channel, commands, guildPrefix);
            break;
        }

        case "updates": {
            updates.sendUpdates(message.channel);
            break;
        }

        case "setactivity": {
            if (message.author.id !== config.ownerId) {
                return messages.error(message.channel, "You do not have permission to use this command!");
            }

            let activityTypeStr = args.shift()?.toLowerCase();
            let activityName;

            let url;

            if (activityTypeStr === 'streaming') {
                if (args.length === 0) {
                    return messages.error(message.channel, `For 'streaming' activity, you must provide a name and a valid URL. Usage: \`${guildPrefix}setactivity streaming <name> <url}>\``);
                }
                const lastArg = args[args.length - 1];
                if (lastArg.startsWith('http://') || lastArg.startsWith('https://')) {
                    url = args.pop();
                    activityName = args.join(" ");
                } else {
                    activityName = args.join(" ");
                }
            }


            if (!activityTypeStr || !activityName) {
                let usageMessage = `Usage: \`${guildPrefix}setactivity <type> <name>\`\nTypes: playing, listening, watching, competing`;
                if (activityTypeStr === 'streaming') {
                    usageMessage = `Usage: \`${guildPrefix}setactivity streaming <name> <url>\` (URL required)`;
                }
                return messages.error(message.channel, usageMessage);
            }

            let activityType;
            const activityOptions = {};

            switch (activityTypeStr) {
                case 'playing':
                    activityType = ActivityType.Playing;
                    break;
                case 'listening':
                    activityType = ActivityType.Listening;
                    break;
                case 'watching':
                    activityType = ActivityType.Watching;
                    break;
                case 'competing':
                    activityType = ActivityType.Playing;
                    break;
                case 'streaming':
                    activityType = ActivityType.Streaming;
                    if (!url) {
                        return messages.error(message.channel, `For 'streaming' activity, you must provide a valid URL (e.g., Twitch or YouTube). Usage: \`${guildPrefix}setactivity streaming <name> <url>\``);
                    }
                    const twitchRegex = /^https:\/\/(www\.)?twitch\.tv\/[a-zA-Z0-9_]+$/i;
                    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.*$/i;
                    if (!twitchRegex.test(url) && !youtubeRegex.test(url)) {
                        return messages.error(message.channel, "Streaming URL must be a valid Twitch or YouTube link.");
                    }
                    activityOptions.url = url;
                    break;
                default:
                    return messages.error(message.channel, "Invalid activity type. Please use: playing, listening, watching, competing, or streaming.");
            }

            try {
                client.user.setActivity(activityName, { type: activityType, ...activityOptions });
                let successMsg = `Bot activity set to: **${activityTypeStr.charAt(0).toUpperCase() + activityTypeStr.slice(1)} ${activityTypeStr === 'streaming' ? '' : activityName}**`;
                if (url) {
                    successMsg += ` (URL: ${url})`;
                }
                messages.success(message.channel, successMsg);
                logger.log(
                    `${emojis.info} Activity Changed`,
                    `**User:** ${message.author.tag} (\`${message.author.id}\`)\n**New Activity:** ${activityTypeStr.charAt(0).toUpperCase() + activityTypeStr.slice(1)} ${activityName} ${url ? `(URL: ${url})` : ''}`,
                    '#f39c12'
                );
            } catch (err) {
                console.error(`Failed to set activity: ${err.message}`);
                messages.error(message.channel, "Failed to set bot activity. Please try again.");
                logger.error("Set Activity Command", err);
            }
            break;
        }

        case "prefix": {
            if (!message.guild) {
                return messages.error(message.channel, "This command can only be used in a server!");
            }

            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== config.ownerId) {
                return messages.error(message.channel, "You need `Administrator` permissions or be the bot owner to change the prefix.");
            }

            const newPrefix = args[0];
            if (!newPrefix) {
                return messages.error(message.channel, `Please provide a new prefix. Current prefix for this server is: \`${guildPrefix}\`\nUsage: \`${guildPrefix}prefix <new_prefix}>\``);
            }
            if (newPrefix.length > 5) {
                return messages.error(message.channel, "Prefix cannot be longer than 5 characters.");
            }

            prefixManager.setPrefix(message.guild.id, newPrefix);
            messages.success(message.channel, `Prefix for this server has been set to: \`${newPrefix}\`.\nYou can now use commands like \`${newPrefix}play\`.`);
            logger.log(
                `${emojis.info} Prefix Changed`,
                `**New Prefix:** \`${newPrefix}\`\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#3498db'
            );
            break;
        }

        case "ping": {
            const sentMessage = await message.channel.send("Pinging...");

            const discordApiLatency = client.ws.ping;

            const botLatency = sentMessage.createdTimestamp - message.createdTimestamp;

            const nodeLatencies = {};
            if (client.riffy && client.riffy.nodeManager && client.riffy.nodeManager.nodes) {
                client.riffy.nodeManager.nodes.forEach(node => {
                    nodeLatencies[node.name] = node.ping;
                });
            }

            messages.ping(message.channel, discordApiLatency, botLatency, nodeLatencies);

            if (sentMessage) {
                await safeDeleteMessage(sentMessage);
            }
            break;
        }

        case "uptime": {
            const uptimeMs = client.uptime;
            messages.uptime(message.channel, uptimeMs);
            break;
        }

        case "play": {
            const query = args.join(" ");
            if (!query) {
                messages.error(message.channel, `Please provide a search query! Usage: \`${guildPrefix}play <query>\``);
                return logger.log(`${emojis.warning} Play Command Failed`, `User ${message.author.tag} used \`!play\` without a query.`, '#f1c40f');
            }
            try {
                const player = client.riffy.createConnection({
                    guildId: message.guild.id,
                    voiceChannel: message.member.voice.channel.id,
                    textChannel: message.channel.id,
                    deaf: true,
                });
                const resolve = await client.riffy.resolve({
                    query: query,
                    requester: message.author,
                });
                const { loadType, tracks, playlistInfo } = resolve;

                if (loadType === "playlist") {
                    for (const track of resolve.tracks) {
                        track.info.requester = message.author;
                        player.queue.add(track);
                    }
                    // Do NOT delete previous "Added to queue/playlist" message here.
                    // Instead, add the new message to the array.

                    // Send new "Added Playlist" message and store its reference
                    const sentMessage = await messages.addedPlaylist(message.channel, playlistInfo, tracks);
                    if (sentMessage) {
                        if (!addedToQueueMessages.has(message.guild.id)) {
                            addedToQueueMessages.set(message.guild.id, []);
                        }
                        addedToQueueMessages.get(message.guild.id).push(sentMessage);
                    }

                    logger.log(
                        `${emojis.music} Playlist Added`,
                        `**Playlist:** [${playlistInfo.name}](${query})\n**Tracks:** ${tracks.length}\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                        '#8e44ad'
                    );
                    if (!player.playing && !player.paused) {
                        return player.play();
                    }
                } else if (loadType === "search" || loadType === "track") {
                    const track = tracks.shift();
                    track.info.requester = message.author;
                    const position = player.queue.length + 1;
                    player.queue.add(track);

                    // Do NOT delete previous "Added to queue/playlist" message here.
                    // Instead, add the new message to the array.

                    // Send new "Added to Queue" message and store its reference
                    const sentMessage = await messages.addedToQueue(message.channel, track, position);
                    if (sentMessage) {
                        if (!addedToQueueMessages.has(message.guild.id)) {
                            addedToQueueMessages.set(message.guild.id, []);
                        }
                        addedToQueueMessages.get(message.guild.id).push(sentMessage);
                    }

                    logger.log(
                        `${emojis.music} Track Added`,
                        `**Track:** [${track.info.title}](${track.info.uri})\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                        '#1abc9c'
                    );
                    if (!player.playing && !player.paused) {
                        return player.play();
                    }
                } else {
                    messages.error(message.channel, "No results found! Try with a different search term.");
                    return logger.log(`${emojis.warning} Play Command No Results`, `User ${message.author.tag} searched for "${query}" with no results.`, '#f1c40f');
                }
            } catch (error) {
                console.error(error);
                messages.error(message.channel, "An error occurred while playing the track! Please try again later.");
                logger.error("Play Command Error", error);
            }
            break;
        }

        case "skip": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) {
                return messages.error(message.channel, "Nothing is playing!");
            }

            const skippedTrack = player.queue.current;

            if (!skippedTrack && player.queue.length === 0) {
                return messages.error(message.channel, "No track is currently playing or in queue to skip!");
            }

            if (!skippedTrack && player.queue.length > 0) {
                 player.play();
            } else { // Current track playing, nothing in queue, not looping
                player.destroy(); 
            }

            if (skippedTrack) { // Log only if a track was actually skipped
                 logger.log(
                    `${emojis.skip} Track Skipped`,
                    `**Track:** [${skippedTrack.info.title}](${skippedTrack.info.uri})\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                    '#e67e22'
                );
            }
            break;
        }

        case "stop": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");

            // Delete the last "Now Playing" message
            await safeDeleteMessage(lastActiveNowPlayingMessage.get(message.guild.id));
            lastActiveNowPlayingMessage.delete(message.guild.id); // Remove from map

            // Delete all lingering "Added to queue" messages
            const guildAddedMessages = addedToQueueMessages.get(message.guild.id);
            if (guildAddedMessages) {
                for (const msg of guildAddedMessages) {
                    await safeDeleteMessage(msg);
                }
                addedToQueueMessages.delete(message.guild.id); // Clear the array from the map
            }

            player.destroy();
            logger.log(
                `${emojis.stop} Music Stopped`,
                `**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#c0392b'
            );
            break;
        }

        case "pause": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");
            if (player.paused) return messages.error(message.channel, "The player is already paused!");

            player.pause(true);
            // Removed: messages.success(message.channel, "Paused the music!");
            logger.log(
                `${emojis.pause} Music Paused`,
                `**Track:** ${player.queue.current ? `[${player.queue.current.info.title}](${player.queue.current.info.uri})` : 'N/A'}\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#f1c40f'
            );
            // After pausing, update the now playing message to show "Resume" button
            const nowPlayingMsg = lastActiveNowPlayingMessage.get(message.guild.id);
            if (nowPlayingMsg) {
                // We need to re-render the buttons based on the new player state
                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('music_toggle_play_pause')
                            .setLabel('Resume')
                            .setStyle(player.paused ? ButtonStyle.Success : ButtonStyle.Primary) // Fixed syntax
                            .setEmoji('▶️'),
                        new ButtonBuilder()
                            .setCustomId('music_skip')
                            .setLabel('Skip')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('⏭️'),
                        new ButtonBuilder()
                            .setCustomId('music_stop')
                            .setLabel('Stop')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('⏹️'),
                        new ButtonBuilder()
                            .setCustomId('music_loop_toggle')
                            .setLabel('Loop')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔁'),
                        new ButtonBuilder()
                            .setCustomId('music_show_queue')
                            .setLabel('Queue')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('📜'),
                    );
                await nowPlayingMsg.edit({ components: [newRow] }).catch(e => console.error("Failed to update pause button:", e));
            }
            break;
        }

        case "resume": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");
            if (!player.paused) return messages.error(message.channel, "The player is already playing!");

            player.pause(false);
            // Removed: messages.success(message.channel, "Resumed the music!");
            logger.log(
                `${emojis.play} Music Resumed`,
                `**Track:** ${player.queue.current ? `[${player.queue.current.info.title}](${player.queue.current.info.uri})` : 'N/A'}\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#27ae60'
            );
            // After resuming, update the now playing message to show "Pause" button
            const nowPlayingMsg = lastActiveNowPlayingMessage.get(message.guild.id);
            if (nowPlayingMsg) {
                // We need to re-render the buttons based on the new player state
                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('music_toggle_play_pause')
                            .setLabel('Pause')
                            .setStyle(player.paused ? ButtonStyle.Success : ButtonStyle.Primary) // Fixed syntax
                            .setEmoji('⏸️'),
                        new ButtonBuilder()
                            .setCustomId('music_skip')
                            .setLabel('Skip')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('⏭️'),
                        new ButtonBuilder()
                            .setCustomId('music_stop')
                            .setLabel('Stop')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('⏹️'),
                        new ButtonBuilder()
                            .setCustomId('music_loop_toggle')
                            .setLabel('Loop')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔁'),
                        new ButtonBuilder()
                            .setCustomId('music_show_queue')
                            .setLabel('Queue')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('📜'),
                    );
                await nowPlayingMsg.edit({ components: [newRow] }).catch(e => console.error("Failed to update resume button:", e));
            }
            break;
        }

        case "queue": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");

            const queue = player.queue;
            if (!queue.length && !player.queue.current) {
                return messages.error(message.channel, "Queue is empty! Add some tracks with the play command.");
            }

            messages.queueList(message.channel, queue, player.queue.current);
            break;
        }

        case "nowplaying": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");
            if (!player.queue.current) return messages.error(message.channel, "No track is currently playing!");

            // Manually trigger sending a new Now Playing message with buttons
            // Deletes old one and sends new, storing in map
            await safeDeleteMessage(lastActiveNowPlayingMessage.get(message.guild.id));
            const sentMessage = await messages.nowPlaying(message.channel, player.queue.current, player); // Pass player object
            if (sentMessage) {
                lastActiveNowPlayingMessage.set(message.guild.id, sentMessage);
            }
            break;
        }

        case "volume": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");

            const volume = parseInt(args[0]);
            if (!volume && volume !== 0 || isNaN(volume) || volume < 0 || volume > 100) {
                return messages.error(message.channel, `Please provide a valid volume between 0 and 100! Usage: \`${guildPrefix}volume <0-100>\``);
            }

            player.setVolume(volume);
            messages.success(message.channel, `Set volume to ${volume}%`);
            logger.log(
                `${emojis.volume} Volume Changed`,
                `**New Volume:** ${volume}%\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#34495e'
            );
            break;
        }

        case "shuffle": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");
            if (!player.queue.length) return messages.error(message.channel, "Not enough tracks in queue to shuffle!");

            player.queue.shuffle();
            messages.success(message.channel, `${emojis.shuffle} Shuffled the queue!`);
            logger.log(
                `${emojis.shuffle} Queue Shuffled`,
                `**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#9b59b6'
            );
            break;
        }

        case "loop": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");

            const currentMode = player.loop;
            const newMode = currentMode === "none" ? "queue" : "none";

            player.setLoop(newMode);
            // Removed: messages.success(interaction.channel, `${newMode === "queue" ? "Enabled" : "Disabled"} loop mode!`);
            logger.log(
                `${emojis.repeat} Loop Mode Toggled`,
                `**New Mode:** ${newMode.toUpperCase()}\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`, // Corrected interaction.user to message.author
                '#3498db'
            );
            // If the loop command is used while a track is playing, update the buttons
            const nowPlayingMsg = lastActiveNowPlayingMessage.get(message.guild.id);
            if (nowPlayingMsg && player.queue.current) {
                 const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('music_toggle_play_pause')
                            .setLabel(player.paused ? 'Resume' : 'Pause')
                            .setStyle(player.paused ? ButtonStyle.Success : ButtonStyle.Primary) // Fixed syntax
                            .setEmoji(player.paused ? '▶️' : '⏸️'),
                        new ButtonBuilder()
                            .setCustomId('music_skip')
                            .setLabel('Skip')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('⏭️'),
                        new ButtonBuilder()
                            .setCustomId('music_stop')
                            .setLabel('Stop')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('⏹️'),
                        new ButtonBuilder()
                            .setCustomId('music_loop_toggle')
                            .setLabel('Loop')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔁'),
                        new ButtonBuilder()
                            .setCustomId('music_show_queue')
                            .setLabel('Queue')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('📜'),
                    );
                await nowPlayingMsg.edit({ components: [newRow] }).catch(e => console.error("Failed to update loop button:", e));
            }
            break;
        }

        case "remove": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");

            const position = parseInt(args[0]);
            if (!position || isNaN(position) || position < 1 || position > player.queue.length) {
                return messages.error(message.channel, `Please provide a valid track position between 1 and ${player.queue.length}! Usage: \`${guildPrefix}remove <position>\``);
            }

            const removed = player.queue.remove(position - 1);
            messages.success(message.channel, `Removed **${removed.info.title}** from the queue!`);
            logger.log(
                `${emojis.remove} Track Removed`,
                `**Track:** [${removed.info.title}](${removed.info.uri})\n**Position:** ${position}\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#e74c3c'
            );
            break;
        }

        case "clear": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");
            if (!player.queue.length) return messages.error(message.channel, "Queue is already empty!");

            player.queue.clear();
            messages.success(message.channel, "Cleared the queue!");
            logger.log(
                `${emojis.clear} Queue Cleared`,
                `**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#d35400'
            );
            break;
        }

        case "status": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "No active player found!");

            messages.playerStatus(message.channel, player);
            break;
        }
    }
});

client.riffy.on("nodeConnect", (node) => {
    console.log(`${emojis.success} Node "${node.name}" connected.`);
    logger.nodeStatus(node.name, 'connected');
});

client.riffy.on("nodeError", (node, error) => {
    console.log(`${emojis.error} Node "${node.name}" encountered an error: ${error.message}.`);
    logger.error(`Node Error: ${node.name}`, error);
});

client.riffy.on("trackStart", async (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);

    // Delete the previous "Now Playing" message (if any)
    await safeDeleteMessage(lastActiveNowPlayingMessage.get(player.guildId));
    lastActiveNowPlayingMessage.delete(player.guildId); // Remove from map

    // "Added to queue" messages are now handled ONLY by the 'play' command (when a new one is added)
    // or by 'stop'/'queueEnd' events. They will NOT be deleted here.

    // Send the new "Now Playing" message and store its reference WITH THE PLAYER OBJECT
    const sentMessage = await messages.nowPlaying(channel, track, player); // Pass player object here
    if (sentMessage) {
        lastActiveNowPlayingMessage.set(player.guildId, sentMessage);
    }
    logger.playerEvent('Track Started', player, track);
});

client.riffy.on("queueEnd", async (player) => {
    const channel = client.channels.cache.get(player.textChannel);

    // Delete the last "Now Playing" message
    await safeDeleteMessage(lastActiveNowPlayingMessage.get(player.guildId));
    lastActiveNowPlayingMessage.delete(player.guildId);

    // Delete all lingering "Added to queue" messages
    const guildAddedMessages = addedToQueueMessages.get(player.guildId);
    if (guildAddedMessages) {
        for (const msg of guildAddedMessages) {
            await safeDeleteMessage(msg);
        }
        addedToQueueMessages.delete(player.guildId); // Clear the array from the map
    }

    player.destroy();
    // Removed messages.queueEnded here.
    logger.playerEvent('Queue Ended', player);
});

// --- Button Interaction Handler ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return; // Only process button interactions

    const { customId, guildId, channelId } = interaction;
    const player = client.riffy.players.get(guildId);

    // Only respond to music control buttons
    if (!customId.startsWith('music_')) return;

    // Defer the update to prevent "This interaction failed" error
    // This tells Discord that the bot is processing the interaction
    await interaction.deferUpdate().catch(e => console.error("Failed to defer update:", e));


    if (!player) {
        // If no player, tell the user gracefully via an ephemeral message
        return interaction.followUp({ content: `${emojis.error} Nothing is playing!`, ephemeral: true });
    }
    if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel) {
        return interaction.followUp({ content: `${emojis.error} You must be in the same voice channel as the bot to use controls!`, ephemeral: true });
    }
    if (player.textChannel !== channelId) {
        // Option: Ignore or reply ephemerally if button is clicked in wrong channel
        // For simplicity, we ignore if clicked in wrong text channel to avoid spam
        return;
    }

    // Safely get current track for logging
    const currentTrackForLog = player.queue.current;
    const trackTitleForLog = currentTrackForLog ? `[${currentTrackForLog.info.title}](${currentTrackForLog.info.uri})` : 'N/A';

    switch (customId) {
        case 'music_toggle_play_pause':
            if (player.paused) {
                player.pause(false);
                // Removed: messages.success(interaction.channel, "Resumed the music!");
                logger.log(
                    `${emojis.play} Music Resumed (Button)`,
                    `**Track:** ${trackTitleForLog}\n**User:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n**Server:** ${interaction.guild.name} (\`${interaction.guild.id}\`)`,
                    '#27ae60'
                );
            } else {
                player.pause(true);
                // Removed: messages.success(interaction.channel, "Paused the music!");
                logger.log(
                    `${emojis.pause} Music Paused (Button)`,
                    `**Track:** ${trackTitleForLog}\n**User:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n**Server:** ${interaction.guild.name} (\`${interaction.guild.id}\`)`,
                    '#f1c40f'
                );
            }
            // Update the button's state after action
            const nowPlayingMsg = lastActiveNowPlayingMessage.get(guildId);
            if (nowPlayingMsg) {
                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('music_toggle_play_pause')
                            .setLabel(player.paused ? 'Resume' : 'Pause')
                            .setStyle(player.paused ? ButtonStyle.Success : ButtonStyle.Primary) // Fixed syntax
                            .setEmoji(player.paused ? '<:pjad_play:1161595194630754334>' : '<:pjad_pause:1161595191573094453>'),
                        new ButtonBuilder()
                            .setCustomId('music_skip')
                            .setLabel('Skip')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('<:pjad_skip:1161595199617781822>'),
                        new ButtonBuilder()
                            .setCustomId('music_stop')
                            .setLabel('Stop')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('<:pjad_stop:1161595204302798909>'),
                        new ButtonBuilder()
                            .setCustomId('music_loop_toggle')
                            .setLabel('Loop')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('<:pjad_loop:1161595185357135892>'),
                        new ButtonBuilder()
                            .setCustomId('music_show_queue')
                            .setLabel('Queue')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('<:pjad_queue:1161595196425912331>'),
                    );
                await nowPlayingMsg.edit({ components: [newRow] }).catch(e => console.error("Failed to update play/pause button via interaction:", e));
            }
            break;

        case 'music_skip':
            if (!player.queue.current && player.queue.length === 0) {
                return interaction.followUp({ content: `${emojis.error} No track is currently playing or in queue to skip!`, ephemeral: true });
            }
            // Use the pre-fetched currentTrackForLog
            if (player.queue.length > 0 || player.loop !== "none") {
                player.stop(); // This triggers trackStart for next song
            } else {
                player.destroy(); // Stops playback entirely
            }

            if (currentTrackForLog) { // Log only if a track was actually skipped
                 logger.log(
                    `${emojis.skip} Track Skipped (Button)`,
                    `**Track:** ${trackTitleForLog}\n**User:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n**Server:** ${interaction.guild.name} (\`${interaction.guild.id}\`)`,
                    '#e67e22'
                );
            }
            break;

        case 'music_stop':
            if (!player) {
                return interaction.followUp({ content: `${emojis.error} Nothing is playing to stop!`, ephemeral: true });
            }
            // Delete the last "Now Playing" message
            await safeDeleteMessage(lastActiveNowPlayingMessage.get(guildId));
            lastActiveNowPlayingMessage.delete(guildId); // Remove from map

            // Delete all lingering "Added to queue" messages
            const guildAddedMessagesOnStop = addedToQueueMessages.get(guildId);
            if (guildAddedMessagesOnStop) {
                for (const msg of guildAddedMessagesOnStop) {
                    await safeDeleteMessage(msg);
                }
                addedToQueueMessages.delete(guildId); // Clear the array from the map
            }

            player.destroy(); // Stops and destroys the player
            logger.log(
                `${emojis.stop} Music Stopped (Button)`,
                `**User:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n**Server:** ${interaction.guild.name} (\`${interaction.guild.id}\`)`,
                '#c0392b'
            );
            break;

        case 'music_loop_toggle':
            const currentMode = player.loop;
            const newMode = currentMode === "none" ? "queue" : "none"; // Toggle between none and queue for simplicity
            player.setLoop(newMode);
            // Removed: messages.success(interaction.channel, `${newMode === "queue" ? "Enabled" : "Disabled"} loop mode!`);
            logger.log(
                `${emojis.repeat} Loop Mode Toggled (Button)`,
                `**New Mode:** ${newMode.toUpperCase()}\n**User:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n**Server:** ${interaction.guild.name} (\`${interaction.guild.id}\`)`,
                '#3498db'
            );
            // If the loop command is used while a track is playing, update the buttons
            const nowPlayingMsgLoop = lastActiveNowPlayingMessage.get(guildId);
            if (nowPlayingMsgLoop && player.queue.current) {
                 const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('music_toggle_play_pause')
                            .setLabel(player.paused ? 'Resume' : 'Pause')
                            .setStyle(player.paused ? ButtonStyle.Success : ButtonStyle.Primary) // Fixed syntax
                            .setEmoji(player.paused ? '<:pjad_play:1161595194630754334>' : '<:pjad_pause:1161595191573094453>'),
                        new ButtonBuilder()
                            .setCustomId('music_skip')
                            .setLabel('Skip')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('<:pjad_skip:1161595199617781822>'),
                        new ButtonBuilder()
                            .setCustomId('music_stop')
                            .setLabel('Stop')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('<:pjad_stop:1161595204302798909>'),
                        new ButtonBuilder()
                            .setCustomId('music_loop_toggle')
                            .setLabel('Loop')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('<:pjad_loop:1161595185357135892>'),
                        new ButtonBuilder()
                            .setCustomId('music_show_queue')
                            .setLabel('Queue')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('<:pjad_queue:1161595196425912331>'),
                    );
                await nowPlayingMsgLoop.edit({ components: [newRow] }).catch(e => console.error("Failed to update loop button:", e));
            }
            break;

        case 'music_show_queue':
            if (!player || (!player.queue.length && !player.queue.current)) {
                return interaction.followUp({ content: `${emojis.error} Queue is empty! Add some tracks with the play command.`, ephemeral: true });
            }
            messages.queueList(interaction.channel, player.queue, player.queue.current);
            // No need to edit the now playing message buttons here, it's a separate info command.
            break;
    }
});


client.on("raw", (d) => {
    if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
    client.riffy.updateVoiceState(d);
});

client.login(config.botToken);
