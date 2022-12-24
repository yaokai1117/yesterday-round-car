import 'dotenv/config';
import express from 'express';
import bodyParser from "body-parser";
import fs from 'fs';
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, sendMessage } from './utils.js';
import { fetchLatestPosts } from './fetch_weibo.js';
import {
  ARKNIGHTS_NEWS_COMMAND,
  CAHIR_COMMAND,
  HELP_COMMAND,
  createCommandsIfNotExists,
  deleteCommands,
} from './commands.js';
import {CommandHandler, CommandHandlerRegistry} from './command_handler.js';
import { Console } from 'console';

// Create an express app
const app = express();
// Get port, or default to 8080
const PORT = process.env.PORT || 8080;

const PUBLIC_FILE_PREFIX = 'https://ayk1117.link/static/';

const DATA_STORE_FILE_PATH = 'datastore.json';

const postDict = {};
const sortedPostIds = [];
const supportedQueries = ['更新公告', '常驻标准寻访', '新装限时上架'];
const queryToPostId = {};
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
    for (const option of options) {
      if (option.name == 'index') {
        newsIndex = Math.min(9, option.value - 1);
      }
      if (option.name == 'query') {
        postId = queryToPostId[option.value];
      }
    }
  }
  if (postId == undefined) postId = sortedPostIds[newsIndex];

  const post = postDict[postId];
  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: post.text,
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

app.listen(PORT, async function ()  {
  console.log('Listening on port', PORT);
  console.log(process.env.NODE_ENV);
  
  // Reload from json file.
  loadFromDataStore();
  // Reload by sending RPCs.
  // await regeneratePosts();

  // Register command handlers.
  [
    HELP_COMMAND_HANDLER, 
    ARKNIGHTS_NEWS_COMMAND_HANDLER, 
    CAHIR_COMMAND_HANDLER
  ].forEach((handler) => commandHandlerRegistry.register(handler));

  for (const guildId of process.env.GUILD_ID.split(',')) {
    // Delete old commands.
    // await deleteCommands(process.env.APP_ID, guildId, ['arknights-news', 'cahir', 'test']);

    // Register commands.
    await createCommandsIfNotExists(process.env.APP_ID, guildId, [
      ARKNIGHTS_NEWS_COMMAND,
      CAHIR_COMMAND,
      HELP_COMMAND,
    ]);
  }

  // Fetch new posts every 30 seconds.
  setInterval(async function() {
    const newPostIds = await regeneratePosts();
    for (const id of newPostIds) {
      for (const channelId of process.env.CHANNEL_ID.split(',')) {
        await sendMessage(channelId, postDict[id].text);
      }
    }
  }, 30000);
});

function wrappedVerifyKeyMiddleware(clientPublicKey) {
  if (process.env.NODE_ENV == "prod") {
    return verifyKeyMiddleware(clientPublicKey);
  }
  else {
    return bodyParser.json();
  }
}

function loadFromDataStore() {
  const storedData = JSON.parse(fs.readFileSync(DATA_STORE_FILE_PATH));
  for (const key in storedData) {
    postDict[key] = storedData[key];
  }
  regenerateSortedPostIds();
}

async function regeneratePosts() {
  try {
    const newPostIds = await fetchLatestPosts(process.env.WEIBO_USER_ID, postDict);
    regenerateSortedPostIds();
    fs.writeFileSync(DATA_STORE_FILE_PATH, JSON.stringify(postDict));
    return newPostIds;
  } catch (error) {
    console.log(error);
    exceptionCount++;
    if (exceptionCount > 100) {
      throw Error('Met more than 100 excpetions, shut down the server.');
    }
    return [];
  }
}

function regenerateSortedPostIds() {
  const sorted = Object.keys(postDict);
  sorted.sort((a, b) => b - a);

  for (const query of supportedQueries) {
    for (const id of sorted) {
      if (postDict[id].text.slice(0, 50).includes(query)) {
        queryToPostId[query] = id;
        break;
      }
    }
  }

  sortedPostIds.length = 0;
  sortedPostIds.push(...sorted);
}
