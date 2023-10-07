import 'dotenv/config';
import { InteractionResponseType } from 'discord-interactions';
import fetch from 'node-fetch';

export async function DiscordRequest(endpoint, options) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function sendMessage(channelId, message) {
  try {
    await DiscordRequest(`channels/${channelId}/messages`, { method: 'POST', body: {
      content: message
    } });
    return true;
  } catch (error) {
    console.log(`${Date.now()} ${error}`);
    return false;
  }
}

export async function editInteractionResponse(applicationId, token, message) {
  try {
    await DiscordRequest(`webhooks/${applicationId}/${token}/messages/@original`, { method: 'PATCH', body: {
      content: message
    } });
    return true;
  } catch (error) {
    console.log(`${Date.now()} ${error}`);
    return false;
  }
}

export async function verifyChannelAccessible(channelId) {
  try {
    await DiscordRequest(`channels/${channelId}`, { method: 'GET' });
    return true;
  } catch (error) {
    console.log(`${Date.now()} ${error}`);
    return false;
  }
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function extractOptionValue(options, name) {
  for (const option of options) {
    if (option.name == name) return option.value;
  }
  return undefined;
}

export function hasDigitsOnly(value) {
  return /^-?\d+$/.test(value);
}
