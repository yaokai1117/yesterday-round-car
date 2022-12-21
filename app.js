import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import {
  ARKNIGHTS_NEWS_COMMAND,
  TEST_COMMAND,
  createCommandsIfNotExists,
  deleteCommands,
} from './commands.js';

// Create an express app
const app = express();
const jsonParser = bodyParser.json();
// Get port, or default to 8080
const PORT = process.env.PORT || 8080;

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};

function wrappedVerifyKeyMiddleware(clientPublicKey) {
  if (process.env.NODE_ENV == "prod") {
    
  console.log('yes', process.env.NODE_ENV);
    return verifyKeyMiddleware(clientPublicKey);
  }
  else {
    console.log('no', process.env.NODE_ENV);
    return (req, res, next) => {next();};
  }
}

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', wrappedVerifyKeyMiddleware(process.env.PUBLIC_KEY), jsonParser, async function (req, res) {
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
    // "challenge" guild command
    if (name === 'challenge' && id) {
      const userId = req.body.member.user.id;
      const newsSize = req.body.data.options.length == 0 ? 1 : Math.max(5, req.body.data.options[0].value);

      // Create active game using message ID as the game ID
      activeGames[id] = {
        id: userId,
        objectName,
      };

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Fetch news of size <@${newsSize}>`,
        },
      });
    }
  }
  
  res.status(400).send('Bad request: unsupported interaction type.');
});

app.get("/", (req, res, next) => {
  res.send("Hello World\n");
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
  console.log(process.env.NODE_ENV);

  deleteCommands(process.env.APP_ID, process.env.GUILD_ID, ['challenge']);
  
  createCommandsIfNotExists(process.env.APP_ID, process.env.GUILD_ID, [
    TEST_COMMAND,
    ARKNIGHTS_NEWS_COMMAND,
  ]);
});
