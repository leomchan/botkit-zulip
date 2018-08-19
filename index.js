const zulip = require('zulip-js');
const _ = require('underscore');
const escapeStringRegexp = require('escape-string-regexp');

module.exports = function(Botkit, controllerConfig) {

  if (!controllerConfig) {
    controllerConfig = {};
  }

  if (!controllerConfig.studio_token) {
    controllerConfig.studio_token = process.env.BOTKIT_STUDIO_TOKEN || process.env.studio_token;
  }

  var controller = Botkit.core(controllerConfig);

  function addMissingBotConfigEntries(botConfig) {
    if (!botConfig.zulip) {
      botConfig.zulip = {
        username: process.env.BOTKIT_ZULIP_BOT,
        apiKey: process.env.BOTKIT_ZULIP_API_KEY,
        realm: process.env.BOTKIT_ZULIP_SITE || 'http://localhost:9991'  
      };
    }

    if (!botConfig.studio_token) {
      botConfig.studio_token = controllerConfig.studio_token;
    }
  }

  /**
   * Create zulip connection. At some point pass in config as well?
   */
  function createZulip(botConfig) {
    return zulip(botConfig.zulip);
  }
   
  controller.defineBot(function(botkit, config) {
    if (!config) {
      config = {};
    }

    addMissingBotConfigEntries(config);

    var botZulip = createZulip(config);

    var bot = {
      type: 'zulip',
      botkit: botkit,
      config: config || {},
      utterances: botkit.utterances,
      zulip: botZulip,
      profile: botZulip.then(z => z.users.me.getProfile())
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
                    if (!event.message.is_me_message && event.message.sender_email.trim().toLowerCase() != config.zulip.username.trim().toLowerCase()) {
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
            }).catch(err => {
              console.warn('Failed to retrieve events.');
              console.log(err);
              return retrieveEvents(lastEventId);
            });
          }

          retrieveEvents(res.last_event_id);
        });
      console.log('Listening to subscriptions…');
    });
    
    return bot;
  });

  controller.middleware.normalize.use(function (bot, message, next) {
    bot.profile.then(p => {
      switch (message.raw_message.type) {
        case 'stream':

          // Is this a direct mention, mention, or ambient?
          var escapedMention = escapeStringRegexp('@**' + p.full_name + '**');
          var escapedDirectMention = '^' + escapedMention;
          var directMentionRegex = new RegExp(escapedDirectMention);
          message.text = message.raw_message.content;
          
          if (directMentionRegex.test(message.text)) {
            message.type = 'direct_mention';
          } else {
            var mentionRegex = new RegExp(escapedMention);
            if (mentionRegex.test(message.text)) {
              message.type = 'mention';
            } else {
              message.type = 'ambient';
            }
          }
          
          message.user = message.raw_message.sender_email;
  
          // Map Zulip stream name + topic to a BotKit channel.
          // Encode as JSON, because there doesn't appear to be too many restrictions on what characters
          // a stream name or topic can contain
          message.channel = JSON.stringify({
            stream: message.raw_message.display_recipient,
            subject: message.raw_message.subject
          });
          break;
        
        case 'private':
          message.type = 'direct_message';
          message.user = message.raw_message.sender_email;
          message.text = message.raw_message.content;

          // For private messages, map sorted json encoding of emails as the channel
          var emails = _.map(message.raw_message.display_recipient, (recipient) => recipient.email).sort();
          message.channel = JSON.stringify(emails);
          break;

        default:
          console.warn('Unsupported zulip event type %s', message.raw_message.type);
          console.warn(message.raw_message);
          break;
      }  
    }).then(() => next());
  });

  controller.middleware.format.use(function(bot, message, platformMessage, next) {
    var channel = JSON.parse(message.channel);
    // If the channel is a JSON array, then map to a private message
    if (Array.isArray(channel)) {
      platformMessage.type = 'private';
      platformMessage.to = message.channel;
      platformMessage.content = message.text;
      platformMessage.subject = '';
    } else if (channel.stream && channel.subject) {
      platformMessage.type = 'stream';
      platformMessage.to = channel.stream;
      platformMessage.subject = channel.subject;
      platformMessage.content = message.text;
    } else {
      console.warn('Unable to format message');
      console.warn(message);
      platformMessage = message;
    }
    next();
  });

  return controller;
};