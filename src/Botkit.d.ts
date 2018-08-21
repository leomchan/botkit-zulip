import * as Botkit from "botkit";

declare module 'botkit' {
  interface CoreConfiguration extends Configuration {

  }

  interface CoreBot extends Bot<CoreConfiguration, Message> {
  }

  interface CoreController<S extends CoreConfiguration, M extends Message, B extends Bot<S, M>> 
    extends Controller<S, M, B> {
    defineBot(builder: (controller: CoreController, botConfig: CoreConfiguration) => Bot<CoreConfiguration, Message>);

    readonly middleware: {
      capture: {
        use(cb: (bot: B, message: M, convo: Conversation<M>, next: () => void) => void): void;
      };
      heard: {
        use(cb: (bot: B, message: M, next: () => void) => void): void;
      };
      receive: {
        use(cb: (bot: B, message: M, next: () => void) => void): void;
      };
      send: {
        use(cb: (bot: B, message: M, next: () => void) => void): void;
      };
      spawn: {
        use(cb: (bot: B, next: () => void) => void): void;
      };
      format: {
        use(cb: (bot: B, message: M, platformMessage: M, next: () => void) => void): void;
      }
    }
  }

  export function core(config: CoreConfiguration): CoreController;

  export interface Controller<S, M extends Message, B extends Bot<S, M>> {
    on(events: string[], cb: HearsCallback<S, M, B>): this;
  }

  interface Conversation<M extends Message> {
    isActive(): boolean;
    source_message: M;
  }
}