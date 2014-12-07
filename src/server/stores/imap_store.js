BetaJS.Stores.BaseStore.extend("BetaJS.Stores.ImapStore", {
	
	constructor: function (options) {
		this._inherited(BetaJS.Stores.ImapStore, "constructor", options);
		this.__imap = BetaJS.Objs.extend(BetaJS.Objs.clone(options.base, 1), options.imap);
		this.__smtp = BetaJS.Objs.extend(BetaJS.Objs.clone(options.base, 1), options.smtp);
		this.__imap_opts = options.imap_options || {};
		this.__imap_opts.reconnect_on_error = false;
	},
	
	test: function () {
		var imap = new BetaJS.Server.Net.Imap(this.__imap, this.__imap_opts);
		return imap.connect().callback(imap.destroy, imap);
	},
	
	_query_capabilities: function () {
		return {
			skip: true,
			limit: true
		};
	},

	_query: function (query, options) {
		var self = this;
		var imap = new BetaJS.Server.Net.Imap(this.__imap, this.__imap_opts);
		return imap.connect().mapSuccess(function () {
			var opts = {};
			if ("skip" in options)
				opts.seq_start = options.skip + 1;
			if ("limit" in options)
				opts.seq_count = options.limit;
			opts.reverse = true;
			return imap.fetch(opts).success(function (mails) {
				imap.destroy();
			}, this);
		}, this);
	},
	
	_insert: function (mail) {
		BetaJS.Server.Net.Smtp.send(this.__smtp, {
 			from: mail.from,
 			to: mail.to,
 			subject: mail.subject,
			text_body: mail.text_body
		}).mapCallback(function (err, msg) {
			if (err)
				return new BetaJS.Stores.StoreException(err);
			mail.id = msg.header["message-id"];
			return mail;
		});
	}
	
});


BetaJS.Stores.ListenerStore.extend("BetaJS.Stores.ImapListenerStore", {

	constructor: function (options) {
		this._inherited(BetaJS.Stores.ImapListenerStore, "constructor", options);
		var opts = BetaJS.Objs.extend(BetaJS.Objs.clone(options.base, 1), options.imap);
		var imap = new BetaJS.Server.Net.Imap(opts, {reonnect_on_error: true});
		this._auto_destroy(imap);
		imap.on("new_mail", function (count) {
			imap.fetch({seq_count: count, reverse: true}).success(function (mails) {
				BetaJS.Objs.iter(mails, function (mail) {
					this._inserted(mail);
				}, this);
			}, this);
		}, this);
		imap.connect();
	}
	
});