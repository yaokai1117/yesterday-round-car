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
  TEST_COMMAND,
  createCommandsIfNotExists,
  deleteCommands,
} from './commands.js';

// Create an express app
const app = express();
// Get port, or default to 8080
const PORT = process.env.PORT || 8080;

const PUBLIC_FILE_PREFIX = 'https://ayk1117.link/static/';

const DATA_STORE_FILE_PATH = 'datastore.json';

const postDict = {};
const sortedPostIds = [];
let exceptionCount = 0;

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', wrappedVerifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" guild command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'hello world ' + getRandomEmoji(),
        },
      });
    }
    
    // "cahir" guild command
    if (name === 'cahir') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: `${PUBLIC_FILE_PREFIX}cahir/${Math.floor(Math.random() * process.env.NUM_CAHIR_PHOTOS) + 1}.jpg`,
        },
      });
    }

    // "arknights-news" guild command
    if (name === 'arknights-news' && id) {
      const newsIndex = req.body.data.options ? Math.min(9, req.body.data.options[0].value - 1) : 0;

      const post = postDict[sortedPostIds[newsIndex]];
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: generateMessageFromPost(post),
        },
      });
    }
  }
  
  res.status(400).send(`Bad request: unsupported interaction type: ${name}`);
});

app.get("/", async function (req, res, next) {
  if (process.env.NODE_ENV == "prod") { 
   res.send("Hello World\n");
  } else {
    await fetchLatestPosts(process.env.WEIBO_USER_ID. postDict);
    res.send(JSON.stringify(postDict));
  }
});

// Serve static files.
app.use('/static', express.static('public'));

app.listen(PORT, async function ()  {
  console.log('Listening on port', PORT);
  console.log(process.env.NODE_ENV);
  
  // Reload from json file.
  // loadFromDataStore();
  // Reload by sending RPCs.
  await regeneratePosts();
  
  // Delete old commands.
  // await deleteCommands(process.env.APP_ID, process.env.GUILD_ID, ['arknights-news', 'cahir']);

  // Register commands.
  await createCommandsIfNotExists(process.env.APP_ID, process.env.GUILD_ID, [
    TEST_COMMAND,
    ARKNIGHTS_NEWS_COMMAND,
    CAHIR_COMMAND,
  ]);

  // Fetch new posts every 20 seconds.
  setInterval(async function() {
    const newPostIds = await regeneratePosts();
    for (const id of newPostIds) {
      await sendMessage(process.env.CHANNEL_ID, generateMessageFromPost(postDict[id]));
    }
  }, 20000);
});

function wrappedVerifyKeyMiddleware(clientPublicKey) {
  if (process.env.NODE_ENV == "prod") {
    return verifyKeyMiddleware(clientPublicKey);
  }
  else {
    return bodyParser.json();
  }
}

function generateMessageFromPost(post) {
  let message = post.text.replace(/<\/?[^>]+(>|$)/g, "");
  if (post.imageUrls.length > 0) {
    if (post.imageUrls.length <= 3) {
      message = message + '\n' + post.imageUrls.join(' ');
    } else {
      message = message + '\n' + post.imageUrls.join(',\n');
    }
  }
  return message;
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
  sortedPostIds.length = 0;
  sortedPostIds.push(...sorted);
}
