require('dotenv').config();
const Botkit = require('botkit');

// In a production bot, this should be:
// var controller = require('botkit-zulip')(Botkit, {});
var controller = require('../dist/main')(Botkit, {});

controller.spawn({});

if (controller.config.studio_token) {
  controller.on(['direct_message', 'direct_mention', 'mention', 'ambient'], function (bot, message) {
    controller.studio.runTrigger(bot, message.text, message.user, message.channel, message).then(convo => {
      if (!convo) {
        console.warn('No conversation was matched.');
      } else {
        convo.setVar('current_time', new Date());
        convo.setVar('bot', bot.identity);
      }
    }).catch(err => {
      console.err(err);
      bot.reply(message, 'Error connecting to Botkit Studio.');
    });
  });

  var normalizedPath = require('path').join(__dirname, 'skills');
  require('fs').readdirSync(normalizedPath).forEach(function(file) {
    require('./skills/' + file)(controller);
  });

}

function test_widget_response() {
    let widget_content = JSON.stringify({
        widget_type: 'zform',
        extra_data: {
            type: 'choices',
            heading: 'Pick a fruit:',
            choices: [
                {
                    type: 'multiple_choice',
                    short_name: 'A',
                    long_name: 'Apple',
                    reply: 'order apple',
                },
                {
                    type: 'multiple_choice',
                    short_name: 'B',
                    long_name: 'Banana',
                    reply: 'order banana',
                },
            ],
        },
    });

    response = {
        content: "Your app does not support buttons, sorry!",
        widget_content: widget_content,
    };

    return response;
}


controller.hears('buttons', 'direct_mention', function(bot, message) {
  bot.reply(message, test_widget_response());
});

controller.hears('order apple', 'direct_mention', function(bot, message) {
  bot.reply(message, "Thanks for ordering an apple. :apple:");
});

controller.hears('order banana', 'direct_mention', function(bot, message) {
  bot.reply(message, "Thanks for ordering a banana. :banana:");
});

controller.hears('test', 'ambient', function(bot, message) {
  bot.reply(message, 'I heard an ambient test.');
});

controller.hears('test', 'direct_message', function(bot, message) {
  bot.reply(message, 'I heard a direct test.');
});

controller.hears('test', 'direct_mention', function(bot, message) {
  bot.reply(message, 'I heard a direct mention test.');
});

controller.hears('test', 'mention', function(bot, message) {
  bot.reply(message, 'I heard a mention test.');
});

controller.hears('help', 'direct_mention', function(bot, message) {
  bot.reply(message, 'Mention me and then type "test" for simple test or "buttons" for buttons.');
});

controller.startTicking();



