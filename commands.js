import { capitalize, DiscordRequest } from './utils.js';

export async function createCommandsIfNotExists(appId, guildId, commands) {
  if (guildId === '' || appId === '') return;

  commands.forEach((c) => createCommandIfNotExists(appId, guildId, c));
}

// Checks for a command
async function createCommandIfNotExists(appId, guildId, command) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' });
    const data = await res.json();

    if (data) {
      const installedNames = data.map((c) => c['name']);
      // This is just matching on the name, so it's not good for updates
      if (!installedNames.includes(command['name'])) {
        console.log(`Installing "${command['name']}"`);
        installGuildCommand(appId, guildId, command);
      } else {
        console.log(`"${command['name']}" command already installed`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

export async function installGuildCommand(appId, guildId, command) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
  // install command
  try {
    await DiscordRequest(endpoint, { method: 'POST', body: command });
  } catch (err) {
    console.error(err);
  }
}

export async function deleteCommands(appId, guildId, commandNames) {
  if (guildId === '' || appId === '') return;

  commandNames.forEach((name) => deleteCommand(appId, guildId, name));
}

async function deleteCommand(appId, guildId, name) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    const res = await DiscordRequest(endpoint, { method: 'GET' });
    const data = await res.json();

    if (data) {
      const command = data.find((d) => d['name'] == name);
      // This is just matching on the name, so it's not good for updates
      if (command === undefined) {
        console.log(`"${name}" command is not installed`);
      } else {
        console.log(`Deleting "${command['name']}"`);
        deleteGuildCommand(appId, guildId, command['id']);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

export async function deleteGuildCommand(appId, guildId, commandId) {
  // API endpoint to get and post guild commands
  const endpoint = `applications/${appId}/guilds/${guildId}/commands/${commandId}`;
  // install command
  try {
    await DiscordRequest(endpoint, { method: 'DELETE' });
  } catch (err) {
    console.error(err);
  }
}

// Simple test command
export const TEST_COMMAND = {
  name: 'test',
  description: 'Basic guild command',
  type: 1,
};

// Commands to get latest arknigts news.
export const ARKNIGHTS_NEWS_COMMAND = {
  name: 'arknights-news',
  description: 'Get the latests updates of this game.',
  options: [
    {
      type: 3,
      name: 'size',
      description: 'How many updates do you want',
    },
  ],
  type: 1,
};