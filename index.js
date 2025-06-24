const { Client, GatewayDispatchEvents, ActivityType, PermissionsBitField } = require("discord.js"); // Add PermissionsBitField
const { Riffy } = require("riffy");
const { Spotify } = require("riffy-spotify");
const config = require("./config.js");
const messages = require("./utils/messages.js");
const emojis = require("./emojis.js");
const updates = require("./utils/updates.js");
const logger = require("./utils/logger.js");
const prefixManager = require("./utils/prefixManager.js"); // <--- NEW: Import prefixManager

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
    { name: 'prefix <new_prefix>', description: 'Change the bot\'s command prefix for this server (Admin only).' }, // <--- This is the new command
    { name: 'help', description: 'Show this help message' }
];

client.on("ready", () => {
    client.riffy.init(client.user.id);
    console.log(`${emojis.success} Logged in as ${client.user.tag}`);

    // Initialize logger and prefixManager
    logger.init(client);
    prefixManager.loadPrefixes(); // <--- NEW: Load prefixes on bot start

    // Log bot startup
    logger.log(
        `${emojis.success} Bot Started`,
        `Logged in as **${client.user.tag}** (\`${client.user.id}\`)\nCurrently in **${client.guilds.cache.size}** servers.`,
        '#2ecc71' // Green
    );

    // Set initial bot activity as STREAMING with Kyvexmusic URL
    client.user.setActivity('Kyvex Music', { type: ActivityType.Streaming, url: 'https://www.twitch.tv/kyvexmusic' });
    console.log(`${emojis.info} Bot activity set to: Streaming Kyvex Music (https://www.twitch.tv/kyvexmusic)`);
});

// Log server joins
client.on('guildCreate', (guild) => {
    logger.guildJoin(guild);
});

// Log server leaves
client.on('guildDelete', (guild) => {
    logger.guildLeave(guild);
});


client.on("messageCreate", async (message) => {
    if (message.author.bot) return; // Ignore bot messages

    // <--- NEW: Get the prefix for the current guild dynamically
    const guildPrefix = message.guild ? prefixManager.getPrefix(message.guild.id) : config.prefix;

    if (!message.content.startsWith(guildPrefix)) return;

    const args = message.content.slice(guildPrefix.length).trim().split(" ");
    const command = args.shift().toLowerCase();

    // Log every command usage
    logger.commandUsed(command, message);

    // Check if user is in a voice channel for music commands
    const musicCommands = ["play", "skip", "stop", "pause", "resume", "queue", "nowplaying", "volume", "shuffle", "loop", "remove", "clear"];
    if (musicCommands.includes(command)) {
        if (!message.member.voice.channel) {
            return messages.error(message.channel, "You must be in a voice channel!");
        }
    }

    switch (command) {
        case "help": {
            messages.help(message.channel, commands, guildPrefix); // <--- IMPORTANT: Pass guildPrefix
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
                    return messages.error(message.channel, `For 'streaming' activity, you must provide a name and a valid URL. Usage: \`${guildPrefix}setactivity streaming <name> <url>\``);
                }
                const lastArg = args[args.length - 1];
                if (lastArg.startsWith('http://') || lastArg.startsWith('https://')) {
                    url = args.pop();
                    activityName = args.join(" ");
                } else {
                    activityName = args.join(" ");
                }
            } else {
                activityName = args.join(" ");
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
                    activityType = ActivityType.Competing;
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
                if (activityTypeStr === 'streaming') successMsg += ` ${activityName}`;
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

        case "prefix": { // <--- NEW: Prefix command logic starts here
            if (!message.guild) {
                return messages.error(message.channel, "This command can only be used in a server!");
            }

            // Check if the user has Administrator permission OR is the bot owner
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== config.ownerId) {
                return messages.error(message.channel, "You need `Administrator` permissions or be the bot owner to change the prefix.");
            }

            const newPrefix = args[0];
            if (!newPrefix) {
                return messages.error(message.channel, `Please provide a new prefix. Current prefix for this server is: \`${guildPrefix}\`\nUsage: \`${guildPrefix}prefix <new_prefix>\``);
            }
            if (newPrefix.length > 5) { // Prevent excessively long prefixes
                return messages.error(message.channel, "Prefix cannot be longer than 5 characters.");
            }

            prefixManager.setPrefix(message.guild.id, newPrefix); // Set and save the new prefix
            messages.success(message.channel, `Prefix for this server has been set to: \`${newPrefix}\`.\nYou can now use commands like \`${newPrefix}play\`.`);
            logger.log(
                `${emojis.info} Prefix Changed`,
                `**New Prefix:** \`${newPrefix}\`\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#3498db' // Blue
            );
            break;
        }

        // --- Existing music commands (play, skip, stop, etc.) will remain here ---
        // IMPORTANT: Update any error/usage messages in existing commands to use 'guildPrefix'
        // instead of 'config.prefix' for accuracy. Example:
        case "play": {
            const query = args.join(" ");
            if (!query) {
                messages.error(message.channel, `Please provide a search query! Usage: \`${guildPrefix}play <query>\``); // Updated usage message
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
                    messages.addedPlaylist(message.channel, playlistInfo, tracks);
                    logger.log(
                        `${emojis.music} Playlist Added`,
                        `**Playlist:** [${playlistInfo.name}](${query})\n**Tracks:** ${tracks.length}\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                        '#8e44ad' // Purple
                    );
                    if (!player.playing && !player.paused) return player.play();
                } else if (loadType === "search" || loadType === "track") {
                    const track = tracks.shift();
                    track.info.requester = message.author;
                    const position = player.queue.length + 1;
                    player.queue.add(track);
                    messages.addedToQueue(message.channel, track, position);
                    logger.log(
                        `${emojis.music} Track Added`,
                        `**Track:** [${track.info.title}](${track.info.uri})\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                        '#1abc9c' // Cyan
                    );
                    if (!player.playing && !player.paused) return player.play();
                } else {
                    messages.error(message.channel, "No results found! Try with a different search term.");
                    return logger.log(`${emojis.warning} Play Command No Results`, `User ${message.author.tag} searched for "${query}" with no results.`, '#f1c40f');
                }
            } catch (error) {
                console.error(error);
                messages.error(message.channel, "An error occurred while playing the track! Please try again later.");
                logger.error("Play Command Error", error); // Log the error
            }
            break;
        }

        // ... continue with other music commands, updating usage messages if needed
        case "skip": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");
            if (!player.queue.length) return messages.error(message.channel, "No more tracks in queue to skip to!");

            const skippedTrack = player.queue.current;
            player.stop();
            messages.success(message.channel, "Skipped the current track!");
            logger.log(
                `${emojis.skip} Track Skipped`,
                `**Track:** [${skippedTrack.info.title}](${skippedTrack.info.uri})\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#e67e22' // Orange
            );
            break;
        }

        case "stop": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");

            player.destroy();
            messages.success(message.channel, "Stopped the music and cleared the queue!");
            logger.log(
                `${emojis.stop} Music Stopped`,
                `**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#c0392b' // Dark Red
            );
            break;
        }

        case "pause": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");
            if (player.paused) return messages.error(message.channel, "The player is already paused!");

            player.pause(true);
            messages.success(message.channel, "Paused the music!");
            logger.log(
                `${emojis.pause} Music Paused`,
                `**Track:** [${player.queue.current.info.title}](${player.queue.current.info.uri})\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#f1c40f' // Yellow
            );
            break;
        }

        case "resume": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");
            if (!player.paused) return messages.error(message.channel, "The player is already playing!");

            player.pause(false);
            messages.success(message.channel, "Resumed the music!");
            logger.log(
                `${emojis.play} Music Resumed`,
                `**Track:** [${player.queue.current.info.title}](${player.queue.current.info.uri})\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#27ae60' // Dark Green
            );
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

            messages.nowPlaying(message.channel, player.queue.current);
            break;
        }

        case "volume": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");

            const volume = parseInt(args[0]);
            if (!volume && volume !== 0 || isNaN(volume) || volume < 0 || volume > 100) {
                return messages.error(message.channel, `Please provide a valid volume between 0 and 100! Usage: \`${guildPrefix}volume <0-100>\``); // Updated usage message
            }

            player.setVolume(volume);
            messages.success(message.channel, `Set volume to ${volume}%`);
            logger.log(
                `${emojis.volume} Volume Changed`,
                `**New Volume:** ${volume}%\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#34495e' // Dark Blue/Gray
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
                '#9b59b6' // Purple
            );
            break;
        }

        case "loop": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");

            const currentMode = player.loop;
            const newMode = currentMode === "none" ? "queue" : "none";

            player.setLoop(newMode);
            messages.success(message.channel, `${newMode === "queue" ? "Enabled" : "Disabled"} loop mode!`);
            logger.log(
                `${emojis.repeat} Loop Mode Toggled`,
                `**New Mode:** ${newMode.toUpperCase()}\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#3498db' // Blue
            );
            break;
        }

        case "remove": {
            const player = client.riffy.players.get(message.guild.id);
            if (!player) return messages.error(message.channel, "Nothing is playing!");

            const position = parseInt(args[0]);
            if (!position || isNaN(position) || position < 1 || position > player.queue.length) {
                return messages.error(message.channel, `Please provide a valid track position between 1 and ${player.queue.length}! Usage: \`${guildPrefix}remove <position>\``); // Updated usage message
            }

            const removed = player.queue.remove(position - 1);
            messages.success(message.channel, `Removed **${removed.info.title}** from the queue!`);
            logger.log(
                `${emojis.remove} Track Removed`,
                `**Track:** [${removed.info.title}](${removed.info.uri})\n**Position:** ${position}\n**User:** ${message.author.tag} (\`${message.author.id}\`)\n**Server:** ${message.guild.name} (\`${message.guild.id}\`)`,
                '#e74c3c' // Red
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
                '#d35400' // Dark Orange
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
    messages.nowPlaying(channel, track);
    logger.playerEvent('Track Started', player, track);
});

client.riffy.on("queueEnd", async (player) => {
    const channel = client.channels.cache.get(player.textChannel);
    player.destroy();
    messages.queueEnded(channel);
    logger.playerEvent('Queue Ended', player);
});

client.on("raw", (d) => {
    if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
    client.riffy.updateVoiceState(d);
});

client.login(config.botToken);
