import * as Botkit from "botkit";

declare module 'botkit' {
  interface CoreConfiguration extends Configuration {

  }

  interface CoreBot extends Bot<CoreConfiguration, Message> {
  }

  interface CoreController extends Controller<CoreConfiguration, Message, Bot<CoreConfiguration, Message>> {
    defineBot(builder: (controller: CoreController, botConfig: CoreConfiguration) => Bot<CoreConfiguration, Message>);
  }

  export function core(config: CoreConfiguration): CoreController;

  export interface Controller<S, M extends Message, B extends Bot<S, M>> {
    on(events: string[], cb: HearsCallback<S, M, B>): this;
  }
}