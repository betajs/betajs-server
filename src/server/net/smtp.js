BetaJS.Server.Net.Smtp = {
	
	send: function (config, message) {
		var email = require("emailjs");
		message.from = BetaJS.Strings.email_get_email(message.from);
		message.to = BetaJS.Strings.email_get_email(message.to);
		if (message.text_body) {
			message.text = message.text_body;
			delete message.text_body;
		}
		var promise = BetaJS.Promise.create();
 		email.server.connect(config).send(email.message.create(message), promise.asyncCallbackFunc());
 		return promise;
	}
	
};