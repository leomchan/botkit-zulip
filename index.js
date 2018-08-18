const zulip = require('zulip-js');
const _ = require('underscore');

module.exports = function(Botkit, config) {

  var controller = Botkit.core(config);

  /**
   * Create zulip connection. At some point pass in config as well?
   */
  function createZulip(config) {
    return zulip(config || {
      username: process.env['BOTKIT_ZULIP_BOT'],
      apiKey: process.env['BOTKIT_ZULIP_API_KEY'],
      realm: process.env['BOTKIT_ZULIP_SITE'] || 'http://localhost:9991'
    });
  }
   
  controller.defineBot(function(botkit, config) {
    var bot = {
      type: 'zulip',
      botkit: botkit,
      config: config || {},
      utterances: botkit.utterances,
      zulip: createZulip(config)
    };

    // send a message
    bot.send = function(message, cb) {
      console.log(message);
      cb();
    };

    // construct a reply
    bot.reply = function (src, resp, cb) {
      console.log('Reply src');
      console.log(src);
      console.log('Reply resp');
      console.log(resp);
      bot.say(resp, cb);
    };

    // mechanism to look for ongoing conversations
    bot.findConversation = function(message, cb) {
      for (var t = 0; t < botkit.tasks.length; t++) {
        for (var c = 0; c < botkit.tasks[t].convos.length; c++) {
          if (
            botkit.tasks[t].convos[c].isActive() &&
            botkit.tasks[t].convos[c].source_message.user == message.user &&
            botkit.excludedEvents.indexOf(message.type) == -1 // this type of message should not be included
          ) {
            cb(botkit.tasks[t].convos[c]);
            return;
          }
        }
      }
      cb();
    };

    // Listen for messages on subscribed streams
    bot.zulip.then(z => {
      z.queues.register({event_types: ['message']})
        .then(res => {
          
          function retrieveEvents(lastEventId) {
            return z.events.retrieve({
              queue_id: res.queue_id,
              last_event_id: lastEventId,
              dont_block: false
            }).then(eventsRes => {
              var maxEventId = _.reduce(eventsRes.events, (max, event) => {
                switch (event.type) {
                  case 'message':
                    controller.ingest(bot, event.message);
                    break;
                  default:
                    console.log(event);
                }

                if (event.id > max) {
                  return event.id;
                } else {
                  return max;
                }
              }, lastEventId);

              return retrieveEvents(maxEventId);
            });
          }

          retrieveEvents(res.last_event_id);
        });
      console.log('Listening to subscriptions…');
    });
    
    return bot;
  });

  return controller;
};