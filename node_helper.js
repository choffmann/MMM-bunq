/* Magic Mirror
 * Node Helper: MMM-bunq
 *
 * By Cedrik Hoffmann
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
var crypto = require("crypto");
const fetch = require("node-fetch");
const request = require("request");

module.exports = NodeHelper.create({
  start: function () {
    this.monetaryDescription = null;
    this.apiKey = null;
    this.publicKey = null;
    this.privateKey = null;
    this.instToken = null;
    this.userId = null;
    this.sessionToken = null;
    this.deviceId = null;
    this.iban = null;
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "HERE_IS_YOUR_CONFIG":
        this.apiKey = payload.apiKey;
        this.monetaryDescription = payload.monetaryDescription;
        this.iban = payload.iban;
        this.crypto();
        break;
      case "UPDATE_PLEASE":
        this.crypto();
        break;
    }
  },

  crypto: function () {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048, // the length of your key in bits
      publicKeyEncoding: {
        type: "spki", // recommended to be 'spki' by the Node.js docs
        format: "pem"
      },
      privateKeyEncoding: {
        type: "pkcs8", // recommended to be 'pkcs8' by the Node.js docs
        format: "pem"
      }
    });

    this.publicKey = publicKey;
    this.privateKey = privateKey;

    this.installation();
  },

  installation: function () {
    const body = JSON.stringify({ client_public_key: this.publicKey });
    const options = {
      method: "POST",
      port: 443,
      url: "https://api.bunq.com/v1/installation",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "User-Agent": "MagicMirror",
        "X-Bunq-Language": "de_DE",
        "X-Bunq-Region": "de_DE",
        "X-Bunq-Request-Id": Math.random() * 9,
        "X-Bunq-Geolocation": "0 0 0 0 000"
      }
    };

    request.post(
      "https://api.bunq.com/v1/installation",
      {
        json: { client_public_key: this.publicKey }
      },
      (err, res, data) => {
        if (!err && res.statusCode === 200) {
          this.handleInstData(data);
        } else {
          console.log(err);
        }
      }
    );
  },

  device: function () {
    const body = JSON.stringify({
      description: "MagicMirror",
      secret: this.apiKey
    });
    fetch("https://api.bunq.com/v1/device-server", {
      method: "POST",
      headers: {
        "User-Agent": "MagicMirror",
        "X-Bunq-Client-Authentication": this.instToken
      },
      body: body
    })
      .then((response) => response.json())
      .then((data) => this.handleDeviceData(data))
      .catch((error) => console.log("Error: ", error));
  },

  session: function () {
    const body = JSON.stringify({
      secret: this.apiKey
    });

    const sign = crypto.createSign("sha256");
    sign.update(body);
    const sig = sign.sign(this.privateKey, "base64");

    fetch("https://api.bunq.com/v1/session-server", {
      method: "POST",
      headers: {
        "X-Bunq-Client-Signature": sig,
        "X-Bunq-Client-Authentication": this.instToken
      },
      body: body
    })
      .then((response) => response.json())
      .then((data) => this.handleSessionData(data))
      .catch((error) => console.log("Error: ", error));
  },

  getSaldo: function () {
    fetch("https://api.bunq.com/v1/user/" + this.userId + "/monetary-account", {
      method: "GET",
      headers: {
        "User-Agent": "MagicMirror",
        "X-Bunq-Client-Authentication": this.sessionToken
      }
    })
      .then((response) => response.json())
      .then((data) => this.handleSaldoData(data))
      .catch((error) => console.log("Error: ", error));
  },

  handleInstData: function (data) {
    this.sendSocketNotification("HERE_IS_INST_TOKEN", data);
    this.instToken = data.Response[1].Token.token;
    this.device();
  },

  handleDeviceData: function (data) {
    this.sendSocketNotification("HERE_IS_DEVICE_TOKEN", data);
    this.deviceId = data.Response[0].Id.id;
    this.session();
  },

  handleSessionData: function (data) {
    this.sendSocketNotification("HERE_IS_SESSION", data);
    this.sessionToken = data.Response[1].Token.token;
    this.userId = data.Response[2].UserPerson.id;
    this.getSaldo();
  },

  handleSaldoData: function (data) {
    this.sendSocketNotification("HERE_IS_SALDO", data);
    let accounts = data.Response;
    let isFound = false;
    for (let i = 0; i < accounts.length && !isFound; i++) {
      if (this.iban !== "") {
        for (
          let j = 0;
          j < accounts[i].MonetaryAccountBank.alias.length && !isFound;
          j++
        ) {
          if (
            accounts[i].MonetaryAccountBank.alias[j].type === "IBAN" &&
            accounts[i].MonetaryAccountBank.alias[j].value === this.iban
          ) {
            this.sendSocketNotification(
              "HERE_IS_FINAL_SALDO",
              accounts[i].MonetaryAccountBank.balance.value
            );
            isFound = true;
          }
        }
      } else {
        // OLD!!!
        if (
          accounts[i].MonetaryAccountBank.description !== undefined &&
          accounts[i].MonetaryAccountBank.description ===
            this.monetaryDescription
        ) {
          this.sendSocketNotification(
            "HERE_IS_FINAL_SALDO",
            accounts[i].MonetaryAccountBank.balance.value
          );
          isFound = true;
        }
      }
    }
  }
});
