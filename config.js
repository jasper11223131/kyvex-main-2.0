// config.js
module.exports = {
    botToken: "TOKEN", // Your Discord Bot Token (REQUIRED)
    ownerId: "1089170457640570930",         // Your Discord User ID (for bot owner commands, RECOMMENDED)
    prefix: ".",                             // Default prefix for your bot commands
    embedColor: "#7289DA",                   // Default color for embeds (Discord blue as an example)

    nodes: [
        // Lavalink Node Configuration (REQUIRED for music playback)
        {
            name: "Main Node",                  // A name for your Lavalink node
            host: "lavalinkv4.serenetia.com",                  // Lavalink server address (e.g., your server IP or domain)
            port: 80,                         // Lavalink server port (default is 2333)
            password: "https://dsc.gg/ajidevserver",        // Lavalink server password (default is "youshallnotpass")
            secure: false,                      // Set to 'true' if your Lavalink uses SSL/TLS (HTTPS), 'false' for HTTP
        },
        // You can add more Lavalink nodes here if you have a cluster setup
    ],

    spotify: {
        // Spotify API Credentials (REQUIRED if you want to play Spotify links)
        clientId: "a568b55af1d940aca52ea8fe02f0d93b",       // Get this from Spotify Developer Dashboard
        clientSecret: "e8199f4024fe49c5b22ea9a3dd0c4789", // Get this from Spotify Developer Dashboard
    },

    // Optional: Channel ID where the bot will send detailed logs (e.g., command usage, errors)
    logChannelId: "1372079624531480707", // Leave empty or remove if you don't need a dedicated log channel
};
