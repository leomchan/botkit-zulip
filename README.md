# BotKit connector for Zulip

Follow the [Get Started](https://botkit.ai/getstarted.html) guide to create a BotKit bot.

In your bot's directory, run:

`npm install --save botkit-zulip`

In the bot JavaScript, replace
`var Botkit = require('botkit');`
with
`var Botkit = require('botkit-zulip');`

On your Zulip setting page, create a Generic bot account. Note its email and API key. They will be passed to the connector via the environment variables `BOTKIT_ZULIP_BOT` and `BOTKIT_ZULIP_API_KEY` respectively.

The bot will only listen to streams it is subscribed to.

To run the bot locally, use:

`BOTKIT_ZULIP_BOT=botkit-bot@example.com BOTKIT_ZULIP_API_KEY=your_key node .`

To run the bot with a self-hosted version of Zulip use:

`BOTKIT_ZULIP_SITE=https://zulip.example.com BOTKIT_ZULIP_BOT=botkit-bot@example.com BOTKIT_ZULIP_API_KEY=your_key node .`



