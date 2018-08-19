require('dotenv').config();
const Botkit = require('botkit');

// In a production bot, this should be:
// var controller = require('botkit-zulip')(Botkit, {});
var controller = require('./index')(Botkit, {});

controller.spawn({});

if (controller.config.studio_token) {
  controller.on(['direct_message', 'direct_mention', 'mention', 'ambient'], function (bot, message) {
    controller.studio.runTrigger(bot, message.text, message.user, message.channel, message).then(convo => {
      if (!convo) {
        console.warn('No conversation was matched.');
      } else {
        convo.setVar('current_time', new Date());
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


controller.startTicking();



