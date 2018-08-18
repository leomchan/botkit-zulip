const Botkit = require('botkit');

var controller = require('./index')(Botkit, {
  studio_token: 'UKbj3BykT1lsalFyW4O75Rm1Iv8IeIrVD8HHyEY3bC0Xwstr9V3BGq6aNq4AeSix'
});

controller.spawn({
  username: 'applejack-bot@localhost',
  apiKey: 'JemHHWPRoseS5zuuPnEChdFekQtJSHc1',
  realm: 'http://localhost:9991'
});

controller.hears('test','message_received', function(bot, message) {
  console.log(message);
  bot.reply(message,'I heard a test');
});

controller.startTicking();

