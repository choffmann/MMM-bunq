/* global Module */

/* Magic Mirror
 * Module: MMM-bunq
 *
 * By Cedrik Hoffmann
 * MIT Licensed.
 */

Module.register("MMM-bunq", {
	defaults: {
		monetaryDescription: "",
		iban: "",
		apiKey: "",
		updateInterval: 60000,
		title: "balance",
		unit: "€",
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	start: function () {
		var self = this;
		this.finalSaldo = 0;

		this.sendSocketNotification('HERE_IS_YOUR_CONFIG', this.config);
		setInterval(function () {
			self.sendSocketNotification('UPDATE_PLEASE');
			self.updateDom();
		}, this.config.updateInterval);
	},

	getDom: function () {

		// create element wrapper for show into the module
		var wrapper = document.createElement("div");
		wrapper.id = "saldo";
		wrapper.innerText = this.config.title + ": " + this.finalSaldo + this.config.unit;

		return wrapper;
	},

	getScripts: function () {
		return [];
	},

	getStyles: function () {
		return [
			"MMM-bunq.css",
		];
	},

	// Load translations files
	getTranslations: function () {
		//FIXME: This can be load a one file javascript definition
		return {
			en: "translations/en.json",
			de: "translations/de.json"
		};
	},

	// socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		if (notification === "HERE_IS_FINAL_SALDO") {
			this.finalSaldo = payload;
			this.updateDom();
		}
	},

});
