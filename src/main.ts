/// <reference path="Botkit.d.ts"/>
/// <reference path="zulip-js.d.ts"/>
import zulip = require('zulip-js');
const _ = require('underscore');
const escapeStringRegexp = require('escape-string-regexp');
import * as Botkit from "botkit";

namespace zulipbot {
  export interface Configuration extends Botkit.CoreConfiguration {
    zulip?: zulip.Configuration;
  }
  
  export interface Message extends Botkit.Message {
    zulipType: string;
    type: string;
    subject?: string;
    to: string;
    content: string;
    sender_email: string;
    display_recipient: string;
  }
  
  export interface Bot extends Botkit.Bot<Configuration, Message> {
    readonly type: string;
    readonly config: Configuration;
    readonly zulip: Promise<zulip.Zulip>
  }
  
  export interface Controller extends Botkit.CoreController<Configuration, Message, Bot> {
    readonly utterances: {
      readonly yes: RegExp;
      readonly no: RegExp;
      readonly quit: RegExp;
    };

    readonly tasks: {
      convos: Botkit.Conversation<Message>[]
    }[];

    readonly excludedEvents: string[];
  }
}

function zulipbot(botkit: typeof Botkit, controllerConfig: zulipbot.Configuration): Botkit.Controller<zulipbot.Configuration, zulipbot.Message, Botkit.Bot<zulipbot.Configuration, zulipbot.Message>> {

  if (!controllerConfig) {
    controllerConfig = {};
  }

  if (!controllerConfig.studio_token) {
    controllerConfig.studio_token = process.env.BOTKIT_STUDIO_TOKEN || process.env.studio_token;
  }

  let controller = Botkit.core(controllerConfig);

  function addMissingBotConfigEntries(botConfig: zulipbot.Configuration) {
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
  function createZulip(botConfig: zulipbot.Configuration): Promise<zulip.Zulip> {
    return zulip(botConfig.zulip);
  }
   
  controller.defineBot(function(botkit: zulipbot.Controller, config: zulipbot.Configuration) {
    if (!config) {
      config = {};
    }

    addMissingBotConfigEntries(config);

    let zulipConnectionPromise = createZulip(config);

    let bot: zulipbot.Bot = {
      type: 'zulip',
      botkit: botkit,
      config: config || {},
      utterances: botkit.utterances,
      zulip: zulipConnectionPromise,
      identity: {
        name: 'N/A',
        emails: []
      },
      // Placeholder. CoreBot will redefine say later.
      say: (message: string | zulipbot.Message, cb?: (err: Error, res?: any) => void) => {},
      // Placeholder. CoreBot will redefine createConversation later.
      createConversation: (message: zulipbot.Message, cb: (err: Error, convo: Botkit.Conversation<zulipbot.Message>) => void) => {},
      // Placeholder. CoreBot will redefine startConversation later.
      startConversation: (message: zulipbot.Message, cb: (err: Error, convo: Botkit.Conversation<zulipbot.Message>) => void) => {},
      send: (message: zulipbot.Message, cb?: (err: Error, res?: any) => void) => {
        if (message.to) {
          bot.zulip.then(z => {
            z.messages.send(message).then(sendResponse => {
              if (sendResponse.result === 'error') {
                console.error(sendResponse);
              }
  
              if (cb) {
                (<() => void>cb)();
              }
            });
          });
        } else {
          let str: string = 'Message is missing the "to" field';
          console.warn(str);
          console.warn(message);
          if (cb) {
            cb(new Error(str));
          }
        }  
      },
      // construct a reply
      reply: (src: zulipbot.Message, resp: string | zulipbot.Message, cb?: (err: Error, res: any) => void) => {
        let responseMessage: zulipbot.Message;
        let content: string;

        if (typeof(resp) === 'string') {
          content = resp;
        } else {
          content = resp.text || resp.content;
        }
  
        responseMessage = {
          zulipType: src.zulipType,
          type: src.type,
          user: src.user,
          channel: src.channel,
          content: content,
          text: content,
          to: '',
          sender_email: src.sender_email,
          display_recipient: src.display_recipient
        }
  
        bot.say(responseMessage, cb || (() => {}));
      },

      // mechanism to look for ongoing conversations
      findConversation: (message: zulipbot.Message, cb?: (convo?: Botkit.Conversation<zulipbot.Message> | undefined) => void) => {
        for (var t = 0; t < botkit.tasks.length; t++) {
          for (var c = 0; c < botkit.tasks[t].convos.length; c++) {
            if (
              botkit.tasks[t].convos[c].isActive() &&
              botkit.tasks[t].convos[c].source_message.user == message.user &&
              botkit.excludedEvents.indexOf(message.type) == -1 // this type of message should not be included
            ) {
              if (cb) {
                cb(botkit.tasks[t].convos[c]);
              }
              return;
            }
          }
        }

        if (cb) {
          cb();  
        }
      },

      replyWithQuestion: (message, question, cb) => {
        controller.startConversation(message, (convo: Botkit.Conversation<zulipbot.Message>) => {
          convo.ask(question, cb);
        });
      }

    };

    // Listen for messages on subscribed streams
    bot.zulip.then(z => {

      interface RetrieveEventsState {
        queueId?: string;
        lastEventId?: number;
        created?: number;
        failed?: number;
      };

      function retrieveEvents(initialState: RetrieveEventsState): Promise<RetrieveEventsState> {
        return new Promise<RetrieveEventsState>((resolve, reject) => {
          if (initialState && initialState.queueId) {
            resolve(initialState);
          } else {
            z.queues.register({event_types: ['message']})
              .then(res => {
                if (res.queue_id && res.result === 'success') {
                  resolve({
                    queueId: res.queue_id,
                    lastEventId: res.last_event_id,
                    created: Date.now()
                  });  
                } else {
                  reject(res);
                }
              })
              .catch(err => reject(err));
          }
        }).then(state => {
          return z.events.retrieve({
            queue_id: state.queueId,
            last_event_id: state.lastEventId,
            dont_block: false
          }).then(eventsRes => {
            if (eventsRes.result === 'success') {
              let maxEventId: number = _.reduce(eventsRes.events, (max: number, event: zulip.Event) => {
                switch (event.type) {
                  case 'message':
                    // Only ingest messages from other users
                    if (controller.tickInterval && !event.message.is_me_message && config.zulip && config.zulip.username &&
                      event.message.sender_email.trim().toLowerCase() != config.zulip.username.trim().toLowerCase()) {
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
              }, state.lastEventId);
    
              return retrieveEvents({
                queueId: state.queueId,
                lastEventId: maxEventId,
                created: state.created
              });                  
            } else {
              return Promise.reject(eventsRes);
            }
          });
        }).catch(err => {
          console.warn('Failed to retrieve events.');
          console.log(err);

          if (initialState && initialState.created && !initialState.failed) {
            let elapsed = Date.now() - initialState.created;
            console.warn('Failure occurred after %d ms after queue was created.', elapsed);
          }

          if (initialState && initialState.failed) {
            let timeSinceInitialFailure = Date.now() - initialState.failed;
            let delay = Math.min(Math.max(5000, Math.round(timeSinceInitialFailure / 5000) * 5000), 30000);

            return new Promise<RetrieveEventsState>((resolve, reject) => {
              console.log('Reconnecting in %d ms…', delay);
              setTimeout(() => {
                retrieveEvents(initialState).then(x => {
                  resolve(x);
                }).catch(err => {
                  reject(err);
                });
              }, delay);  
            });

          } else {
            console.log('Reconnecting immediately…');
            return retrieveEvents({
              failed: Date.now(),
            });
          }
        });
      }

      retrieveEvents({});
    });

    return bot;
  });

  controller.middleware.spawn.use((bot: zulipbot.Bot, next: () => void) => {
    bot.zulip.then(z => {
      z.users.me.getProfile().then(profile => {
        if (profile.result === 'success') {
          bot.identity.name = profile.full_name;
          bot.identity.shortName = profile.short_name;
          bot.identity.emails = [profile.email];
        }
        next();
      });
    });
  });

  controller.middleware.normalize.use((bot: zulipbot.Bot, message: zulipbot.Message, next: () => void) => {
    switch (message.type) {
      case 'stream':

        // Is this a direct mention, mention, or ambient?
        let escapedMention = escapeStringRegexp('@**' + bot.identity.name + '**');
        let escapedDirectMention = '^' + escapedMention;
        let directMentionRegex = new RegExp(escapedDirectMention);
        message.text = message.content;
        message.zulipType = message.type;

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
        
        message.user = message.sender_email;

        // Map Zulip stream name + topic to a BotKit channel.
        // Encode as JSON, because there doesn't appear to be too many restrictions on what characters
        // a stream name or topic can contain
        message.channel = JSON.stringify({
          stream: message.display_recipient,
          subject: message.subject
        });
        break;
      
      case 'private':
        message.type = 'direct_message';
        message.user = message.sender_email;
        message.text = message.content;

        // For private messages, map sorted json encoding of emails as the channel
        var emails = _.map(message.display_recipient, (recipient: {email: string}) => recipient.email).sort();
        message.channel = JSON.stringify(emails);
        break;

      default:
        console.warn('Unsupported zulip event type %s', message.type);
        console.warn(message);
        break;
    }

    next();
  });

  controller.middleware.format.use((bot: zulipbot.Bot, message: zulipbot.Message, platformMessage: zulipbot.Message, next: () => void) => {
    if (message.channel) {
      var channel = JSON.parse(message.channel);
      // If the channel is a JSON array, then map to a private message
      if (Array.isArray(channel)) {
        platformMessage.type = 'private';
        platformMessage.to = message.channel;
        platformMessage.content = message.text || message.content || '';
      } else if (channel.stream && channel.subject) {
        platformMessage.type = 'stream';
        platformMessage.to = channel.stream;
        platformMessage.subject = channel.subject;
        platformMessage.content = message.text || message.content || '';
      } else {
        console.warn('Unable to format message');
        console.warn(message);
        platformMessage = message;
      }  
    } else {
      console.warn('Message does not have a channel');
      console.warn(message);
    }
    next();
  });

  return controller;
}

export = zulipbot;