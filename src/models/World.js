
var paths = require('../../config/paths'),
  fs = require('fs'),
  botStuff = require("@helpers/bot-stuff"),
  Server = require("@models/Server"),
  auth = require("@auth"),
  bot = botStuff.bot;

class World {
  static get NEGLECT_TIMEOUT_IN_MS() {
    return 30 * 60 * 1000;
  }


  constructor(server_id, server_data) {
    this.servers = {};
    this.broadcastTimout = null;
    this.broadcastID = null;
    this.broadcastMessage = null;
    this.broadcaster = null;
  }

  addServer(server) {
    if (!server.server_id) {
      return;
    }
    this.servers[server.server_id] = server;
    this.save();
  }

  removeServer(server) {
    this.servers[server.server_id] = null;
  }

  resetNeglectTimeouts() {
    for (var server in this.servers) {
      server.resetNeglectTimeout();
    }
  }

  permitAllMasters() {
    for (var server in this.servers) {
      if (server.isBound()) {
        server.setMaster(server.bound_to, server.bound_to_username);
      }
    }
  }

  broadcast(message, user_id) {
    var self = this;
    if (!(auth.dev_ids.indexOf(user_id) >= 0)) {
      return;
    }

    if (this.broadcastID == null) {


      this.broadcastID = (Math.floor(Math.random() * 90000) + 10000) + "";
      this.broadcastMessage = message;
      this.broadcaster = user_id;

      setTimeout(function () {
        self.broadcastID = null;
        self.broadcastMessage = null;
        self.broadcaster = null;
      }, 20000);

      return this.broadcastID;

    } else if (this.broadcaster != user_id) {
      for (var key in bot.servers) {
        var server = bot.servers[key];
        bot.sendMessage({
          to: server.owner_id,
          message: self.broadcastMessage
        });
      }

      self.broadcastID = null;
      self.broadcastMessage = null;
      self.broadcaster = null;
    }

    return null;
  }

  unpermitAll() {
    for (var server in this.servers) {
      server.release();
    }
  }

  getServerFromChannel(channel_id) {
    var chan = bot.channels[channel_id];
    if (chan) {
      var server = this.servers[bot.channels[channel_id].guild_id];
      return server;
    }
    return null;
  }

  checkMastersVoiceChannels(user_id) {
    if (!user_id) return;
    var voiceChan = botStuff.getUserVoiceChannel(user_id);
    for (var server in this.servers) {
      var s = this.servers[server];
      if (s.bound_to == user_id) {
        if (voiceChan != s.current_voice_channel_id)
          s.leaveVoiceChannel();
      }
    }
  }

  initServers() {
    for (var server in bot.servers) {
      if (!this.servers[server]) {
        this.addServer(
          new Server(bot.servers[server])
        );
      }
    }
  }


  save(_filename) {
    function replacer(key, value) {
      if (key == "neglect_timeout") return undefined; // this key is an internal that we dont want to save
      else return value;
    };

    if (!_filename) _filename = paths.state;
    fs.writeFileSync(_filename, JSON.stringify(this.servers, replacer), 'utf-8');
  }

  load() {
    try {
      var file = require(paths.state);
      for (var server_id in file) {
        var server = new Server(file[server_id], server_id);
        this.servers[server_id] = server;
        server.init();
      }
    } catch (ex) {
      console.error(ex);
      this.save();
    }
  }
}

module.exports = new World();