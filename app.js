import 'dotenv/config';
import express from 'express';
import bodyParser from "body-parser";
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji } from './utils.js';
import { fetchLatestPosts } from './fetch_weibo.js';
import {
  ARKNIGHTS_NEWS_COMMAND,
  CAHIR_COMMAND,
  TEST_COMMAND,
  createCommandsIfNotExists,
} from './commands.js';

// Create an express app
const app = express();
// Get port, or default to 8080
const PORT = process.env.PORT || 8080;

const PUBLIC_FILE_PREFIX = 'https://ayk1117.link/static/';

function wrappedVerifyKeyMiddleware(clientPublicKey) {
  if (process.env.NODE_ENV == "prod") {
    return verifyKeyMiddleware(clientPublicKey);
  }
  else {
    return bodyParser.json();
  }
}

// TODO(yaokai): remove this and change to better data store.
var posts = [];

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
      const userId = req.body.member.user.id;
      const newsIndex = req.body.data.options ? Math.min(10, req.body.data.options[0].value) : 1;

      // const posts = await fetchLatestPosts(process.env.WEIBO_USER_ID);
      const post = posts[newsIndex];
      var message = post.text.replace(/<\/?[^>]+(>|$)/g, "");
      if (post.imageUrls.length > 0) {
        if (post.imageUrls.length <= 3) {
          message = message + '\n' + post.imageUrls.join(' ');
        } else {
          message = message + '\n' + post.imageUrls.join('\n');
        }
      }
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: message,
        },
      });
    }
  }
  
  res.status(400).send('Bad request: unsupported interaction type.');
});

app.get("/", async function (req, res, next) {
  if (process.env.NODE_ENV == "prod") { 
   res.send("Hello World\n");
  } else {
    const posts = await fetchLatestPosts(process.env.WEIBO_USER_ID);
    res.send(JSON.stringify(posts));
  }
});

// Serve static files.
app.use('/static', express.static('public'));

app.listen(PORT, async function ()  {
  console.log('Listening on port', PORT);
  console.log(process.env.NODE_ENV);
  
  posts = await fetchLatestPosts(process.env.WEIBO_USER_ID);
  
  createCommandsIfNotExists(process.env.APP_ID, process.env.GUILD_ID, [
    TEST_COMMAND,
    ARKNIGHTS_NEWS_COMMAND,
    CAHIR_COMMAND,
  ]);
});
