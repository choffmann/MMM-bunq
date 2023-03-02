/* Magic Mirror
 * Node Helper: MMM-bunq
 *
 * By Cedrik Hoffmann
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const crypto = require("crypto");
const Log = require("logger");
const fetch = require("node-fetch");

module.exports = NodeHelper.create({
	start: function() {
		//this.url = "https://public-api.sandbox.bunq.com/v1";
		this.url = "https://api.bunq.com/v1";
		this.monetaryDescription = null;
		this.apiKey = null;
		this.publicKey = null;
		this.privateKey = null;
		this.instToken = null;
		this.userId = null;
		this.sessionToken = null;
		this.deviceId = null;
		this.iban = null;
		Log.log(`${this.name} is started`);
	},

	socketNotificationReceived: async function(notification, payload) {
		switch (notification) {
			case "HERE_IS_YOUR_CONFIG":
				this.apiKey = payload.apiKey;
				this.monetaryDescription = payload.monetaryDescription;
				this.iban = payload.iban;
				await this.makeRequest();
				break;
			case "UPDATE_PLEASE":
				await this.makeRequest();
				break;
		}
	},

	makeRequest: async function() {
		this.crypto()
			.then(_ => this.installation())
			.then(_ => this.device())
			.then(_ => this.session())
			.then(_ => this.getSaldo())
			.catch(this.handleError);
	},

	crypto: async function() {
		const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
			modulusLength: 2048, // the length of your key in bits
			publicKeyEncoding: {
				type: "spki", // recommended to be 'spki' by the Node.js docs
				format: "pem"
			}, privateKeyEncoding: {
				type: "pkcs8", // recommended to be 'pkcs8' by the Node.js docs
				format: "pem"
			}
		});

		this.publicKey = publicKey;
		this.privateKey = privateKey;
	},

	fetchData: async function(path, options, callback) {
		await fetch(this.url + path, options)
			.then((response) => response.json())
			.then((data) => callback(data))
			.catch((error) => this.handleError(error));
	},

	handleError: function(error) {
		Log.error(error);
	},

	installation: async function() {
		const options = {
			method: "POST", headers: {
				"Content-Type": "application/json", "Cache-Control": "no-cache", "User-Agent": "MagicMirror", "X-Bunq-Language": "de_DE", "X-Bunq-Region": "de_DE", "X-Bunq-Request-Id": Math.random() * 9, "X-Bunq-Geolocation": "0 0 0 0 000"
			}, body: JSON.stringify({ client_public_key: this.publicKey })
		};
		await this.fetchData("/installation", options, data => this.handleInstData(data));
	},

	device: async function() {
		const options = {
			method: "POST", headers: {
				"User-Agent": "MagicMirror", "X-Bunq-Client-Authentication": this.instToken
			}, body: JSON.stringify({
				description: "MagicMirror", secret: this.apiKey
			})
		};
		await this.fetchData("/device-server", options, data => this.handleDeviceData(data));
	},

	session: async function() {
		const body = JSON.stringify({ secret: this.apiKey });
		const sign = crypto.createSign("sha256");
		sign.update(body);
		const sig = sign.sign(this.privateKey, "base64");
		const options = {
			method: "POST", headers: {
				"X-Bunq-Client-Signature": sig, "X-Bunq-Client-Authentication": this.instToken
			}, body: body
		};

		await this.fetchData("/session-server", options, data => this.handleSessionData(data));
	},

	getSaldo: async function() {
		const options = {
			method: "GET", headers: {
				"User-Agent": "MagicMirror", "X-Bunq-Client-Authentication": this.sessionToken
			}
		};
		await this.fetchData(`/user/${this.userId}/monetary-account`, options, data => this.handleSaldoData(data));
	},

	handleInstData: function(data) {
		this.sendSocketNotification("HERE_IS_INST_TOKEN", data);
		this.instToken = data.Response[1].Token.token;
	},

	handleDeviceData: function(data) {
		this.sendSocketNotification("HERE_IS_DEVICE_TOKEN", data);
		this.deviceId = data.Response[0].Id.id;
	},

	handleSessionData: function(data) {
		this.sendSocketNotification("HERE_IS_SESSION", data);
		this.sessionToken = data.Response[1].Token.token;
		this.userId = data.Response[2].UserPerson.id;
	},

	handleSaldoData: function(data) {
		this.sendSocketNotification("HERE_IS_SALDO", data);
		const accounts = data.Response.filter(obj => obj.MonetaryAccountBank !== undefined);
		accounts.forEach(account => {
			if(account.MonetaryAccountBank.alias[0].value === this.iban) {
				this.sendSocketNotification("HERE_IS_FINAL_SALDO", account.MonetaryAccountBank.balance.value);
			}
		})
	}
});
