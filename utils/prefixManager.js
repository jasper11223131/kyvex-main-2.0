// utils/prefixManager.js
const fs = require('fs');
const path = require('path');
const config = require('../config.js'); // Assuming config.js is one level up from utils

const prefixesFilePath = path.join(__dirname, '../data/prefixes.json');
let guildPrefixes = {}; // In-memory cache to store prefixes { "guildId": "prefix" }

module.exports = {
    /**
     * Loads prefixes from the JSON file into memory when the bot starts.
     */
    loadPrefixes: () => {
        try {
            if (fs.existsSync(prefixesFilePath)) {
                const data = fs.readFileSync(prefixesFilePath, 'utf8');
                guildPrefixes = JSON.parse(data);
                console.log('[PrefixManager] Prefixes loaded from prefixes.json');
            } else {
                console.log('[PrefixManager] prefixes.json not found. Creating an empty one.');
                fs.writeFileSync(prefixesFilePath, JSON.stringify({}, null, 4)); // Create the file
            }
        } catch (error) {
            console.error('[PrefixManager] Error loading prefixes:', error);
            guildPrefixes = {}; // Fallback to empty if there's an error reading the file
        }
    },

    /**
     * Gets the prefix for a specific guild.
     * @param {string} guildId The ID of the guild.
     * @returns {string} The guild's custom prefix, or the default prefix from config.js if not found.
     */
    getPrefix: (guildId) => {
        return guildPrefixes[guildId] || config.prefix;
    },

    /**
     * Sets a new prefix for a guild and saves it to the prefixes.json file.
     * @param {string} guildId The ID of the guild.
     * @param {string} newPrefix The new prefix to set.
     */
    setPrefix: (guildId, newPrefix) => {
        guildPrefixes[guildId] = newPrefix;
        try {
            // Save the updated prefixes object to the file
            fs.writeFileSync(prefixesFilePath, JSON.stringify(guildPrefixes, null, 4), 'utf8');
            console.log(`[PrefixManager] Prefix for guild ${guildId} set to "${newPrefix}" and saved.`);
        } catch (error) {
            console.error(`[PrefixManager] Error saving prefix for guild ${guildId}:`, error);
        }
    }
};
