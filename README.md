# BotKit connector for Zulip

In your bot's directory, run:

`npm install --save botkit-zulip`

## Creating a BotKit controller
In the bot JavaScript, to create a Botkit controller use the following lines.
```javascript
var Botkit = require('botkit');
var controller = require('botkit-zulip')(Botkit, {});
```

## Setup
On your Zulip setting page, create a Generic bot account. Note its email and API key.
The bot will only listen to streams it is subscribed to.

When `controller.spawn()` is called it uses the following environment variables are used to configure the bot.

* `BOTKIT_ZULIP_BOT=bot@example.com` (required)
* `BOTKIT_ZULIP_API_KEY=<Bot api key>` (required)
* `BOTKIT_ZULIP_SITE=https://chat.zulip.org` (optional, defaults to http://localhost:9991)

Alternatively, you can explicitly specify the configuration programatically, like so:
```javascript
controller.spawn({
  zulip: {
    username: 'bot@example.com',
    apiKey: <bot api key>,
    realm: 'https://chat.zulip.org'
  }
});
```

## BotKit Studio integration
To use BotKit studio, obtain a BotKit studio token. See the [BotKit Getting Started Guide](https://botkit.ai/docs/readme-studio.html#getting-started) on how to do this.

Once you have a token, you can set the following environment variable.

* `BOTKIT_STUDIO_TOKEN=<BotKit Studio Token>` (optional)

## Running the test bot
The testbot is intended for quickly trying out the connector during development. It is not intended as a template for a production bot. It would be preferred to follow the official Botkit [Get Started](https://botkit.ai/getstarted.html) guide and then making the modifications described above in *Creating a BotKit controller*.

To use the bot, create a `.env` file with the following contents:
```
BOTKIT_STUDIO_TOKEN=<BotKit Studio token, optional>
BOTKIT_ZULIP_BOT=bot@example.com
BOTKIT_ZULIP_API_KEY=<bot api key>
BOTKIT_ZULIP_SITE=http://localhost:9991
```

and then run `node testbot.js`

If you have `BOTKIT_STUDIO_TOKEN` set, you will also be able to try the starter BotKit Studio scripts that are available to your account. (e.g. *hello*, *goodbye*, *tutorial*, etc.)



