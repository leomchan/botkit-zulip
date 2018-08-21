declare module 'zulip-js' {

  declare namespace zulip {
    export interface Configuration {
      username?: string;
      apiKey?: string;
      realm?: string;  
    }

    export interface RegisterQueueParams {
        apply_markdown?: boolean,
        client_gravatar?: boolean,
        event_types?: string[],
        all_public_streams?: boolean,
        include_subscribers?: boolean,
        fetch_event_types?: string[],
        narrow?: string[]
    }
          
    export interface RegisterQueueResponse {
      queue_id?: string,
      last_event_id?: number,
      result: string
    }
          
    export interface RetrieveEventsParams {
      queue_id?: string,
      last_event_id?: number,
      dont_block?: boolean
    }
          
    export interface Event {
      id: number,
      message: {
        is_me_message?: boolean,
        sender_email: string
      },
      type: string
    }
          
    export interface RetrieveEventsResponse {
      events?: Event[];
      result: string;
    }
          
    export interface ProfileResponse {
      email: string,
      full_name: string,
      short_name: string,
      result: string
    }
          
    export interface Message {
      type: string,
      to: string,
      subject?: string,
      content: string
    }

    export interface Zulip {
      readonly messages: {
        send: (message: Message) => Promise<{result: string}>
      }
          
      readonly queues: {
        register(params: RegisterQueueParams): Promise<RegisterQueueResponse>
      }
          
      readonly events: {
        retrieve(params: RetrieveEventsParams): Promise<RetrieveEventsResponse>
      }
          
      readonly users: {
        readonly me: {
          getProfile(): Promise<ProfileResponse>
        }
      }
    }
  }

  declare function zulip(config: zulip.Configuration | undefined): zulip.Promise<Zulip>;

  export = zulip;
}