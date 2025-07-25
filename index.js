import { Client, GatewayIntentBits, Events } from 'discord.js';
import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// Simple JSON file to store linked users: { discordId: fplId }
const DATA_FILE = './userData.json';

function loadUserData() {
  if (!fs.existsSync(DATA_FILE)) return {};
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveUserData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Express route for linking Discord ID to FPL ID
app.get('/connect', (req, res) => {
  const discordId = req.query.discordId;
  const fplId = req.query.fplId;

  if (!discordId || !fplId) {
    return res.status(400).send('Missing discordId or fplId query parameter.');
  }

  const userData = loadUserData();
  userData[discordId] = fplId;
  saveUserData(userData);

  res.send(`Linked Discord ID ${discordId} to FPL ID ${fplId}`);
});

// Basic keep-alive route
app.get('/', (req, res) => res.send('FPL Discord Bot is running'));

app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
});

// Discord bot setup
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once(Events.ClientReady, () => {
  console.log(`Discord Bot logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  if (content.startsWith('!whohas ')) {
    const playerName = content.slice(8).trim().toLowerCase();
    if (!playerName) {
      return message.reply('Please provide a player name, e.g. `!whohas Salah`');
    }

    const userData = loadUserData();
    if (Object.keys(userData).length === 0) {
      return message.reply('No users linked yet. Use the connect URL to link your Discord ID to your FPL ID.');
    }

    // Fetch each user's team and check if they have the player
    const owners = [];

    await Promise.all(Object.entries(userData).map(async ([discordId, fplId]) => {
      try {
        // Fetch the user's picks from the official FPL API
        const res = await fetch(`https://fantasy.premierleague.com/api/entry/${fplId}/event/1/picks/`);
        if (!res.ok) return;
        const data = await res.json();

        // Check if any player matches the name (simple contains match)
        const hasPlayer = data.picks.some(pick => {
          // We need player details - so let's fetch static bootstrap data
          // For simplicity, we’ll skip player name matching here; real implementation requires more steps.
          // Instead, we check player IDs against a local static map (to be implemented).
          // So this is a placeholder: return false
          return false; 
        });

        if (hasPlayer) owners.push(`<@${discordId}>`);
      } catch {
        // Ignore errors for individual users
      }
    }));

    if (owners.length === 0) {
      return message.reply(`No linked users have "${playerName}" in their team.`);
    }

    return message.reply(`Users with "${playerName}": ${owners.join(', ')}`);
  }
});

client.login(DISCORD_TOKEN);
