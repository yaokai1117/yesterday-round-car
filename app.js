import 'dotenv/config';
import express from 'express';
import bodyParser from "body-parser";
import fs from 'fs';
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { sendMessage, extractOptionValue } from './utils.js';
import { fetchLatestPosts } from './fetch_weibo.js';
import {
  ARKNIGHTS_NEWS_COMMAND,
  ARKNIGHTS_SUBSCRIBE_COMMAND,
  ARKNIGHTS_UNSUBSCRIBE_COMMAND,
  CAHIR_COMMAND,
  HELP_COMMAND,
  createCommandsIfNotExists,
  deleteCommands,
} from './commands.js';
import { CommandHandler, CommandHandlerRegistry } from './command_handler.js';

// Create an express app
const app = express();
// Get port, or default to 8080
const PORT = process.env.PORT || 8080;

const isInProd = process.env.NODE_ENV == "prod";

const PUBLIC_FILE_PREFIX = 'https://ayk1117.link/static/';

const DATA_STORE_FILE_PATH = 'datastore.json';
const SUBSCRIPTION_FILE_PATH = 'subscription.json';

// Those are only used by arknights official weibo.
const ARKNIGHTS_OFFICTIAL_ID = process.env.WEIBO_USER_ID;
const ARKNIGHTS_CHANNELS = process.env.CHANNEL_ID.split(',');
const sortedPostIds = [];
const supportedQueries = ['更新公告', '常驻标准寻访', '新装限时上架'];
const queryToPostId = {};

// A map from Weibo user id to {a map from Weibo post id to post content}.
const weiboUserIdToPosts = {};
// A map from Weibo user id to {a list of supported channels}.
const weiboUserIdToChannels = {};
// A map from Weibo user id to the interval id of fecching data from them.
// Used to cancel subscription.
// We don't need this for arknights official, sine we won't need to cancel the subscription.
const weiboUserIdToIntervalId = {};
let exceptionCount = 0;

const commandHandlerRegistry = new CommandHandlerRegistry([]);

const HELP_COMMAND_HANDLER = new CommandHandler(HELP_COMMAND.name, HELP_COMMAND.description, function (data, res) {
  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: commandHandlerRegistry.generateHelpMessage()
    },
  });
});

const ARKNIGHTS_NEWS_COMMAND_HANDLER = new CommandHandler(ARKNIGHTS_NEWS_COMMAND.name, ARKNIGHTS_NEWS_COMMAND.description, function (data, res) {
  let newsIndex = Math.floor(Math.random() * 10);
  let postId;
  const options = data.options;
  // Parse options if any.
  if (options != undefined) {
    const indexFromOption = extractOptionValue(options, 'index');
    if (indexFromOption) newsIndex = indexFromOption;
    postId = extractOptionValue(options, 'query');
  }
  if (postId == undefined) postId = sortedPostIds[newsIndex];

  const post = weiboUserIdToPosts[ARKNIGHTS_OFFICTIAL_ID][postId];
  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: post.text,
    },
  });
});

const ARKNIGHTS_SUBSCRIBE_COMMAND_HANDLER = new CommandHandler(ARKNIGHTS_SUBSCRIBE_COMMAND.name, ARKNIGHTS_SUBSCRIBE_COMMAND.description, function (data, res) {
  const options = data.options;
  let userId = extractOptionValue(options, 'weibo-user-id');
  let channelId  = extractOptionValue(options, 'channel-id');

  let message;
  if (!(userId in weiboUserIdToChannels)) {
    weiboUserIdToChannels[userId] = [];
  }
  if (weiboUserIdToChannels[userId].includes(channelId)) {
    message = 'Already subscribed before, nothing changed.';
  } else {
    weiboUserIdToChannels[userId].push(channelId);
    if (!(userId in weiboUserIdToIntervalId)) {
      weiboUserIdToIntervalId[userId] = subscribeToWeiboUser(userId, false, function () {});
    }
    message = 'Subscribed!';
    dumpSubscriptionToDataStore();
    console.log(`Subscribed to weibo user ${userId} in channel ${channelId}`);
  }

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: message,
    },
  });
});

const ARKNIGHTS_UNSUBSCRIBE_COMMAND_HANDLER = new CommandHandler(ARKNIGHTS_UNSUBSCRIBE_COMMAND.name, ARKNIGHTS_UNSUBSCRIBE_COMMAND.description, function (data, res) {
  const options = data.options;
  let userId = extractOptionValue(options, 'weibo-user-id');
  let channelId  = extractOptionValue(options, 'channel-id');

  let message;
  if (!(userId in weiboUserIdToChannels)) {
    weiboUserIdToChannels[userId] = [];
  }
  if (!weiboUserIdToChannels[userId].includes(channelId)) {
    message = 'Did not subscribe this, or already unsubscribed.';
  } else {
    weiboUserIdToChannels[userId].splice(weiboUserIdToChannels[userId].indexOf(channelId), 1);
    if (!(userId in weiboUserIdToIntervalId)) {
      message = 'Did not subscribe this, or already unsubscribed.';
    } else {
      if (weiboUserIdToChannels[userId].length == 0) {
        const intervalId = weiboUserIdToIntervalId[userId];
        clearInterval(intervalId);
        delete weiboUserIdToIntervalId[userId];
      }
      message = 'Unsubscribed!';
      dumpSubscriptionToDataStore();
      console.log(`Unsubscribed weibo user ${userId} in channel ${channelId}`);
    }
  }

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: message,
    },
  });
});

const CAHIR_COMMAND_HANDLER = new CommandHandler(CAHIR_COMMAND.name, CAHIR_COMMAND.description, function (data, res) {
  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      // Fetches a random emoji to send from a helper function
      content: `${PUBLIC_FILE_PREFIX}cahir/${Math.floor(Math.random() * process.env.NUM_CAHIR_PHOTOS) + 1}.jpg`,
    },
  });
});

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', wrappedVerifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction type and data
  const { type, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  } else if (type === InteractionType.APPLICATION_COMMAND) {
    commandHandlerRegistry.handleCommand(data, res);
  } else {
    res.status(400).send(`Bad request: unsupported interaction type: ${type}`);
  }
});

app.get("/", async function (req, res, next) {
  res.send("Hello World\n");
});

// Serve static files.
app.use('/static', express.static('public'));

app.listen(PORT, async function () {
  console.log('Listening on port', PORT);
  console.log(`Is in prod: ${isInProd}`);

  weiboUserIdToPosts[ARKNIGHTS_OFFICTIAL_ID] = {};
  weiboUserIdToChannels[ARKNIGHTS_OFFICTIAL_ID] = ARKNIGHTS_CHANNELS;
  loadSubscriptionFromDataStore();

  // Reload from json file.
  loadFromDataStore();
  // Reload by sending RPCs.
  // await regeneratePosts(ARKNIGHTS_OFFICTIAL_ID, true, weiboUserIdToPosts[ARKNIGHTS_OFFICTIAL_ID]);

  // Register command handlers.
  [
    HELP_COMMAND_HANDLER,
    ARKNIGHTS_NEWS_COMMAND_HANDLER,
    ARKNIGHTS_SUBSCRIBE_COMMAND_HANDLER,
    ARKNIGHTS_UNSUBSCRIBE_COMMAND_HANDLER,
    CAHIR_COMMAND_HANDLER
  ].forEach((handler) => commandHandlerRegistry.register(handler));

  for (const guildId of process.env.GUILD_ID.split(',')) {
    // Delete old commands.
    // await deleteCommands(process.env.APP_ID, guildId, ['arknights-news', 'cahir', 'test']);

    // Register commands.
    await createCommandsIfNotExists(process.env.APP_ID, guildId, [
      ARKNIGHTS_NEWS_COMMAND,
      ARKNIGHTS_SUBSCRIBE_COMMAND,
      ARKNIGHTS_UNSUBSCRIBE_COMMAND,
      CAHIR_COMMAND,
      HELP_COMMAND,
    ]);
  }

  // Fetch new posts every 30 seconds.
  subscribeToWeiboUser(ARKNIGHTS_OFFICTIAL_ID, true, regenerateIndex);
});

function wrappedVerifyKeyMiddleware(clientPublicKey) {
  if (isInProd) {
    return verifyKeyMiddleware(clientPublicKey);
  }
  else {
    return bodyParser.json();
  }
}

function subscribeToWeiboUser(userId, isArknightsOfficial, followUpFunction) {
  const delayInSeconds =  isInProd ?
    (isArknightsOfficial ? 30 : 60 + Math.round(Math.random() * 60)) 
    : 20;
  if (!(userId in weiboUserIdToPosts)) {
    weiboUserIdToPosts[userId] = {};
  }
  const postDict = weiboUserIdToPosts[userId];

  const intervalId = setInterval(async function () {
    const isFirstTime = Object.keys(postDict).length == 0;
    const newPostIds = await regeneratePosts(userId, isArknightsOfficial, postDict);
    followUpFunction();
    if (!isInProd) {
      console.log(`Is first time: ${isFirstTime}`);
      console.log(`New post ids: ${newPostIds}`);
      console.log(`Channel ids: ${weiboUserIdToChannels[userId]}`);
    }
    if (isFirstTime) return;
    for (const id of newPostIds) {
      for (const channelId of weiboUserIdToChannels[userId]) {
        if (id in postDict && postDict[id].text != undefined) {
          await sendMessage(channelId, postDict[id].text);
        }
      }
    }
  }, delayInSeconds * 1000);
  return intervalId;
}

// Regenerate posts for a cerain Weibo account, return new post ids.
async function regeneratePosts(userId, isArknightsOfficial, postDict) {
  if (!isInProd) {
    console.log(`Regenerating posts for weibo user: ${userId}, is official: ${isArknightsOfficial}`);
  }
  try {
    const newPostIds = await fetchLatestPosts(userId, postDict);
    // We only dump official posts to offline storage.
    if (isArknightsOfficial) {
      fs.writeFileSync(DATA_STORE_FILE_PATH, JSON.stringify(postDict));
    }
    return newPostIds;
  } catch (error) {
    exceptionCount++;
    console.log(`${Date.now()} Exception count: ${exceptionCount}`);
    console.log(`${Date.now()} error`);
    if (exceptionCount > 100) {
      throw Error('Met more than 100 excpetions, shut down the server.');
    }
    return [];
  }
}

// Only used by arknights official weibo.
function regenerateIndex() {
  const sorted = Object.keys(weiboUserIdToPosts[ARKNIGHTS_OFFICTIAL_ID]);
  sorted.sort((a, b) => b - a);

  for (const query of supportedQueries) {
    for (const id of sorted) {
      if (weiboUserIdToPosts[ARKNIGHTS_OFFICTIAL_ID][id].text.slice(0, 50).includes(query)) {
        queryToPostId[query] = id;
        break;
      }
    }
  }

  sortedPostIds.length = 0;
  sortedPostIds.push(...sorted);
}

// Only used by arknights official weibo.
function loadFromDataStore() {
  const storedData = JSON.parse(fs.readFileSync(DATA_STORE_FILE_PATH));
  for (const key in storedData) {
    weiboUserIdToPosts[ARKNIGHTS_OFFICTIAL_ID][key] = storedData[key];
  }
  regenerateIndex();
}

// Only used by arknights official weibo.
function loadSubscriptionFromDataStore() {
  const subscriptionData = JSON.parse(fs.readFileSync(SUBSCRIPTION_FILE_PATH));
  for (const userId in subscriptionData) {
    if (userId == ARKNIGHTS_OFFICTIAL_ID) continue;
    weiboUserIdToPosts[userId] = {};
    weiboUserIdToChannels[userId] = subscriptionData[userId];
    weiboUserIdToIntervalId[userId] = subscribeToWeiboUser(userId, false, function () {});
  }
}

function dumpSubscriptionToDataStore() {
  const subscriptionData = {};
  for (const userId in weiboUserIdToChannels) {
    if (userId == ARKNIGHTS_OFFICTIAL_ID) continue;
    subscriptionData[userId] = weiboUserIdToChannels[userId];
  }
  fs.writeFileSync(SUBSCRIPTION_FILE_PATH, JSON.stringify(subscriptionData));
}