Here is how I tested out the botkit adapter.  (Some of these
notes are from memory, apologies if I missed a step.)

    <install node and npm> # I already had these

    cd ~ # I started in my home directory, you may have a projects directory
    git clone https://github.com/showell/botkit-zulip.git
    cd botkit-zulip
    npm install

    <install Zulip locally>
    <go to site, in my case it was http://zulip.showell.zulipdev.org:9991/devlogin/>
    <log on as Cordelia>
    <go to Settings/Your bots>
    <create a bot named "botkit" and copy/paste the API key>

    <Create a .env file that looks like this:>

        # Your data will be different, of course.
        BOTKIT_ZULIP_SITE=http://zulip.showell.zulipdev.org:9991
        BOTKIT_ZULIP_API_KEY=A1b2A1b2A1b2A1b2A1b2A1b2A1b2A1b2
        BOTKIT_ZULIP_BOT=botkit-bot@zulip.showell.zulipdev.org

    npm run build && node testbot/testbot.js
    # you could also say "npm run testbot"

    <go to Zulip in browser (see above)>
    <go to stream>
    <say `@**Bot Kit** test`>
    <see the response>

    <say `@**Bot Kit** buttons`>
    <Pick a fruit by hitting a button!>
