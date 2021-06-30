/* global Module */
/* Magic Mirror
 * Module: MMM-bunq
 *
 * By Cedrik Hoffmann
 * MIT Licensed.
 */

Module.register("MMM-bunq", {
	defaults: {
		monetaryAccounts: [
			{
				title: null,
				iban: null,
				isSavingAccount: false
			}
		],
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
		this.displayStart = true;
		this.usingOldMethode = false;
		this.usingNewMethode = false;
		this.finalSaldo = 0;
		this.finalData = [];

		this.sendSocketNotification('HERE_IS_YOUR_CONFIG', this.config);
		setInterval(function () {
			self.sendSocketNotification('UPDATE_PLEASE');
			self.updateDom();
		}, this.config.updateInterval);
	},

	getDom: function () {
		var wrapper = document.createElement("div");

		if (this.displayStart) {
			const start = document.createElement("div");
			start.id = "MMM-bunq-saldo";
			start.innerText = this.config.title + ": " + this.finalSaldo + this.config.unit;
			wrapper.appendChild(start);
		}
		if (this.usingOldMethode) {
			const start = document.createElement("div");
			start.id = "MMM-bunq-saldo";
			start.innerText = this.config.title + ": " + this.finalSaldo + this.config.unit;
			wrapper.appendChild(start);
		}
		if (this.usingNewMethode) {
			this.finalData.forEach(account => {
				if (!account.isSavingAccount) {
					console.log(account)
					const div = document.createElement("div");
					div.id = "MMM-bunq-saldo";
					div.innerText = this.config.title + ": " + account.saldo + this.config.unit;
					wrapper.appendChild(div);
				} else {

				}
			})
		}

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
		switch (notification) {
			case "HERE_IS_FINAL_SALDO":
				this.finalSaldo = payload;
				this.displayStart = false;
				this.usingOldMethode = true;
				this.updateDom();
				break;
			case "HERE_IS_FINAL_SALDO_ARRAY":
				this.finalData = payload
				this.displayStart = false;
				this.usingNewMethode = true;
				this.updateDom();
				break;
		}
	},

});
