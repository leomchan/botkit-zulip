/// <reference path="../src/Botkit.d.ts" />
/// <reference path="../src/zulip-js.d.ts" />
import zulip = require('zulip-js');
import * as Botkit from "botkit";
declare namespace zulipbot {
    interface Configuration extends Botkit.CoreConfiguration {
        zulip?: zulip.Configuration;
    }
    interface Message extends Botkit.Message {
        zulipType: string;
        type: string;
        subject?: string;
        to: string;
        content: string;
        sender_email: string;
        display_recipient: string;
    }
    interface Bot extends Botkit.Bot<Configuration, Message> {
        readonly type: string;
        readonly config: Configuration;
        readonly zulip: Promise<zulip.Zulip>;
    }
    interface Controller extends Botkit.CoreController<Configuration, Message, Bot> {
        readonly utterances: {
            readonly yes: RegExp;
            readonly no: RegExp;
            readonly quit: RegExp;
        };
        readonly tasks: {
            convos: Botkit.Conversation<Message>[];
        }[];
        readonly excludedEvents: string[];
    }
}
declare function zulipbot(botkit: typeof Botkit, controllerConfig: zulipbot.Configuration): Botkit.Controller<zulipbot.Configuration, zulipbot.Message, Botkit.Bot<zulipbot.Configuration, zulipbot.Message>>;
export = zulipbot;
