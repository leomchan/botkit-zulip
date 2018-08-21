const zulip = require('zulip-js');
const _ = require('underscore');
const escapeStringRegexp = require('escape-string-regexp');
import * as Botkit from "botkit";

interface ZulipRegisterQueueParams {
  apply_markdown?: boolean,
  client_gravatar?: boolean,
  event_types?: string[],
  all_public_streams?: boolean,
  include_subscribers?: boolean,
  fetch_event_types?: string[],
  narrow?: string[]
}

interface ZulipRegisterQueueResponse {
  queue_id?: string,
  last_event_id?: number,
  result: string
}

interface ZulipRetrieveEventsParams {
  queue_id?: string,
  last_event_id?: number,
  dont_block?: boolean
}

interface ZulipEvent {
  id: number,
  message: {
    is_me_message?: boolean,
    sender_email: string
  },
  type: string
}

interface ZulipRetrieveEventsResponse {
  events?: ZulipEvent[];
  result: string;
}

interface ZulipProfileResponse {
  email: string,
  full_name: string,
  short_name: string,
  result: string
}

interface ZulipConnection {
  readonly messages: {
    send: (message: ZulipMessage) => Promise<{result: string}>
  }

  readonly queues: {
    register(params: ZulipRegisterQueueParams): Promise<ZulipRegisterQueueResponse>
  }

  readonly events: {
    retrieve(params: ZulipRetrieveEventsParams): Promise<ZulipRetrieveEventsResponse>
  }

  readonly users: {
    readonly me: {
      getProfile(): Promise<ZulipProfileResponse>
    }
  }
}

interface ZulipConfiguration extends Botkit.CoreConfiguration {
  zulip?: {
    username?: string;
    apiKey?: string;
    realm?: string;  
  };
}

interface ZulipMessage extends Botkit.Message {
  zulipType: string;
  type: string;
  subject?: string;
  to: string;
  content: string;
  sender_email: string;
  display_recipient: string;
}

interface ZulipBot extends Botkit.Bot<ZulipConfiguration, ZulipMessage> {
  readonly type: string;
  readonly config: ZulipConfiguration;
  readonly zulip: Promise<ZulipConnection>
}

interface Utterances {
  readonly yes: RegExp;
  readonly no: RegExp;
  readonly quit: RegExp;
}

interface ZulipController extends Botkit.CoreController<ZulipConfiguration, ZulipMessage, ZulipBot> {
  readonly utterances: Utterances;
  readonly tasks: {
    convos: Botkit.Conversation<ZulipMessage>[]
  }[];
  readonly excludedEvents: string[];
}

function zulipbot(botkit: typeof Botkit, controllerConfig: ZulipConfiguration): Botkit.Controller<ZulipConfiguration, ZulipMessage, Botkit.Bot<ZulipConfiguration, ZulipMessage>> {

  if (!controllerConfig) {
    controllerConfig = {};
  }

  if (!controllerConfig.studio_token) {
    controllerConfig.studio_token = process.env.BOTKIT_STUDIO_TOKEN || process.env.studio_token;
  }

  var controller = Botkit.core(controllerConfig);

  function addMissingBotConfigEntries(botConfig: ZulipConfiguration) {
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
  function createZulip(botConfig: ZulipConfiguration): Promise<ZulipConnection> {
    return zulip(botConfig.zulip);
  }
   
  controller.defineBot(function(botkit: ZulipController, config: ZulipConfiguration) {
    if (!config) {
      config = {};
    }

    addMissingBotConfigEntries(config);

    let zulipConnectionPromise = createZulip(config);

    let bot: ZulipBot = {
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
      say: (message: string | ZulipMessage, cb?: (err: Error, res?: any) => void) => {},
      // Placeholder. CoreBot will redefine createConversation later.
      createConversation: (message: ZulipMessage, cb: (err: Error, convo: Botkit.Conversation<ZulipMessage>) => void) => {},
      // Placeholder. CoreBot will redefine startConversation later.
      startConversation: (message: ZulipMessage, cb: (err: Error, convo: Botkit.Conversation<ZulipMessage>) => void) => {},
      send: (message: ZulipMessage, cb?: (err: Error, res?: any) => void) => {
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
      reply: (src: ZulipMessage, resp: string | ZulipMessage, cb?: (err: Error, res: any) => void) => {
        let responseMessage: ZulipMessage;
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
      findConversation: (message: ZulipMessage, cb?: (convo?: Botkit.Conversation<ZulipMessage> | undefined) => void) => {
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
        controller.startConversation(message, (convo: Botkit.Conversation<ZulipMessage>) => {
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
              let maxEventId: number = _.reduce(eventsRes.events, (max: number, event: ZulipEvent) => {
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

  controller.middleware.spawn.use((bot: ZulipBot, next: () => void) => {
    bot.zulip.then(z => {
      z.users.me.getProfile().then(profile => {
        if (profile.result === 'success') {
          bot.identity.name = profile.full_name;
          bot.identity.emails = [profile.email];
        }
        next();
      });
    });
  });

  controller.middleware.normalize.use((bot: ZulipBot, message: ZulipMessage, next: () => void) => {
    switch (message.type) {
      case 'stream':

        // Is this a direct mention, mention, or ambient?
        var escapedMention = escapeStringRegexp('@**' + bot.identity.name + '**');
        var escapedDirectMention = '^' + escapedMention;
        var directMentionRegex = new RegExp(escapedDirectMention);
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

  controller.middleware.format.use((bot: ZulipBot, message: ZulipMessage, platformMessage: ZulipMessage, next: () => void) => {
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