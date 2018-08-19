/*

Botkit Studio Skill module to enhance the "hello" script

*/


module.exports = function(controller) {
  // define a before hook
  // you may define multiple before hooks. they will run in the order they are defined.
  // See: https://botkit.ai/docs/readme-studio.html#controllerstudiobefore
  controller.studio.before('hello', function(convo, next) {

      // do some preparation before the conversation starts...
      // for example, set variables to be used in the message templates
      // convo.setVar('foo','bar');

      console.log('BEFORE: hello');
      // don't forget to call next, or your conversation will never continue.
      next();

  });

  /* Validators */
  // Fire a function whenever a variable is set because of user input
  // See: https://botkit.ai/docs/readme-studio.html#controllerstudiovalidate
  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  // Validate user input: question_1
  controller.studio.validate('hello','question_1', function(convo, next) {

      var value = convo.extractResponse('question_1');

      // test or validate value somehow
      // can call convo.gotoThread() to change direction of conversation

      console.log('VALIDATE: hello VARIABLE: question_1');

      // always call next!
      next();

  });

  // Validate user input: question_2
  controller.studio.validate('hello','question_2', function(convo, next) {

      var value = convo.extractResponse('question_2');

      // test or validate value somehow
      // can call convo.gotoThread() to change direction of conversation

      console.log('VALIDATE: hello VARIABLE: question_2');

      // always call next!
      next();

  });

  // Validate user input: question_3
  controller.studio.validate('hello','question_3', function(convo, next) {

      var value = convo.extractResponse('question_3');

      // test or validate value somehow
      // can call convo.gotoThread() to change direction of conversation

      console.log('VALIDATE: hello VARIABLE: question_3');

      // always call next!
      next();

  });

  /* Thread Hooks */
  // Hook functions in-between threads with beforeThread
  // See: https://botkit.ai/docs/readme-studio.html#controllerstudiobeforethread
  /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

  // Before the default thread starts, run this:
  controller.studio.beforeThread('hello','default', function(convo, next) {

      /// do something fun and useful
      // convo.setVar('name','value');

      console.log('In the script *hello*, about to start the thread *default*');

      // always call next!
      next();
  });

  // Before the on_timeout thread starts, run this:
  controller.studio.beforeThread('hello','on_timeout', function(convo, next) {

      /// do something fun and useful
      // convo.setVar('name','value');

      console.log('In the script *hello*, about to start the thread *on_timeout*');

      // always call next!
      next();
  });


  // define an after hook
  // you may define multiple after hooks. they will run in the order they are defined.
  // See: https://botkit.ai/docs/readme-studio.html#controllerstudioafter
  controller.studio.after('hello', function(convo, next) {

      console.log('AFTER: hello');

      // handle the outcome of the convo
      if (convo.successful()) {

          var responses = convo.extractResponses();
          // do something with the responses

      }

      // don't forget to call next, or your conversation will never properly complete.
      next();
  });
}
