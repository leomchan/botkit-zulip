"use strict";
/// <reference path="Botkit.d.ts"/>
/// <reference path="zulip-js.d.ts"/>
const zulip = require("zulip-js");
const _ = require('underscore');
const escapeStringRegexp = require('escape-string-regexp');
const Botkit = require("botkit");
function zulipbot(botkit, controllerConfig) {
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
    controller.defineBot(function (botkit, config) {
        if (!config) {
            config = {};
        }
        addMissingBotConfigEntries(config);
        let zulipConnectionPromise = createZulip(config);
        let bot = {
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
            say: (message, cb) => { },
            // Placeholder. CoreBot will redefine createConversation later.
            createConversation: (message, cb) => { },
            // Placeholder. CoreBot will redefine startConversation later.
            startConversation: (message, cb) => { },
            send: (message, cb) => {
                if (message.to) {
                    bot.zulip.then(z => {
                        z.messages.send(message).then(sendResponse => {
                            if (sendResponse.result === 'error') {
                                console.error(sendResponse);
                            }
                            if (cb) {
                                cb();
                            }
                        });
                    });
                }
                else {
                    let str = 'Message is missing the "to" field';
                    console.warn(str);
                    console.warn(message);
                    if (cb) {
                        cb(new Error(str));
                    }
                }
            },
            // construct a reply
            reply: (src, resp, cb) => {
                let responseMessage;
                let content;
                if (typeof (resp) === 'string') {
                    content = resp;
                }
                else {
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
                };
                bot.say(responseMessage, cb || (() => { }));
            },
            // mechanism to look for ongoing conversations
            findConversation: (message, cb) => {
                for (var t = 0; t < botkit.tasks.length; t++) {
                    for (var c = 0; c < botkit.tasks[t].convos.length; c++) {
                        if (botkit.tasks[t].convos[c].isActive() &&
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
                controller.startConversation(message, (convo) => {
                    convo.ask(question, cb);
                });
            }
        };
        // Listen for messages on subscribed streams
        bot.zulip.then(z => {
            ;
            function retrieveEvents(initialState) {
                return new Promise((resolve, reject) => {
                    if (initialState && initialState.queueId) {
                        resolve(initialState);
                    }
                    else {
                        z.queues.register({ event_types: ['message'] })
                            .then(res => {
                            if (res.queue_id && res.result === 'success') {
                                resolve({
                                    queueId: res.queue_id,
                                    lastEventId: res.last_event_id,
                                    created: Date.now()
                                });
                            }
                            else {
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
                            let maxEventId = _.reduce(eventsRes.events, (max, event) => {
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
                                }
                                else {
                                    return max;
                                }
                            }, state.lastEventId);
                            return retrieveEvents({
                                queueId: state.queueId,
                                lastEventId: maxEventId,
                                created: state.created
                            });
                        }
                        else {
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
                        return new Promise((resolve, reject) => {
                            console.log('Reconnecting in %d ms…', delay);
                            setTimeout(() => {
                                retrieveEvents(initialState).then(x => {
                                    resolve(x);
                                }).catch(err => {
                                    reject(err);
                                });
                            }, delay);
                        });
                    }
                    else {
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
    controller.middleware.spawn.use((bot, next) => {
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
    controller.middleware.normalize.use((bot, message, next) => {
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
                }
                else {
                    var mentionRegex = new RegExp(escapedMention);
                    if (mentionRegex.test(message.text)) {
                        message.type = 'mention';
                    }
                    else {
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
                var emails = _.map(message.display_recipient, (recipient) => recipient.email).sort();
                message.channel = JSON.stringify(emails);
                break;
            default:
                console.warn('Unsupported zulip event type %s', message.type);
                console.warn(message);
                break;
        }
        next();
    });
    controller.middleware.format.use((bot, message, platformMessage, next) => {
        if (message.channel) {
            var channel = JSON.parse(message.channel);
            // If the channel is a JSON array, then map to a private message
            if (Array.isArray(channel)) {
                platformMessage.type = 'private';
                platformMessage.to = message.channel;
                platformMessage.content = message.text || message.content || '';
            }
            else if (channel.stream && channel.subject) {
                platformMessage.type = 'stream';
                platformMessage.to = channel.stream;
                platformMessage.subject = channel.subject;
                platformMessage.content = message.text || message.content || '';
            }
            else {
                console.warn('Unable to format message');
                console.warn(message);
                platformMessage = message;
            }
        }
        else {
            console.warn('Message does not have a channel');
            console.warn(message);
        }
        next();
    });
    return controller;
}
module.exports = zulipbot;
