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
      if (message.to) {
        bot.zulip.then(z => {
          z.messages.send(message).then(res => {
            if (res.result === 'error') {
              console.error(res);
            }

            cb();
          });
        });
      } else {
        console.warn('Cannot send a message without a recipient.');
        console.warn(message);
        cb();
      }
    };

    // construct a reply
    bot.reply = function (src, resp, cb) {
      if (typeof(resp) === 'string') {
        resp = {
          text: resp
        };
      }

      resp.type = src.type;
      resp.user = src.user;
      resp.channel = src.channel;

      bot.say(resp, cb || (() => {}));
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
                    // Only ingest messages from other users
                    if (event.message.sender_email.trim().toLowerCase() != config.username.trim().toLowerCase()) {
                      controller.ingest(bot, event.message, event.id);
                    }
                    break;
                  case 'heartbeat':
                    // Ignore heartbeats
                    break;
                  default:
                    // Received an unexpected event
                    console.warn(event);
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

  controller.middleware.normalize.use(function (bot, message, next) {
    if (message.raw_message.type === 'stream') {
      message.type = 'message_received';
      message.text = message.raw_message.content;
      message.user = message.raw_message.sender_email;
      message.channel = JSON.stringify({
        stream: message.raw_message.display_recipient,
        subject: message.raw_message.subject
      });
    }
    next();
  });

  controller.middleware.format.use(function(bot, message, platformMessage, next) {
    if (message.type === 'message_received') {
      var channelParts = JSON.parse(message.channel);

      platformMessage.type = 'stream';
      platformMessage.to = channelParts.stream;
      platformMessage.subject = channelParts.subject;
      platformMessage.content = message.text;
    } else {
      platformMessage = message;
    }
    next();
  });

  return controller;
};