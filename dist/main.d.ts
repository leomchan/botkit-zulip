import * as Botkit from "botkit";
export interface ZulipConfiguration extends Botkit.CoreConfiguration {
    zulip?: {
        username?: string;
        apiKey?: string;
        realm?: string;
    };
}
export interface ZulipMessage extends Botkit.Message {
    zulipType: string;
    type: string;
    subject?: string;
    to: string;
    content: string;
    sender_email: string;
    display_recipient: string;
}
export declare function zulipbot(botkit: typeof Botkit, controllerConfig: ZulipConfiguration): Botkit.Controller<ZulipConfiguration, ZulipMessage, Botkit.Bot<ZulipConfiguration, ZulipMessage>>;
