const fs = require("node:fs");
const path = require("node:path");
const { createSeedData } = require("./seed");

class JSONStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.ensure();
  }

  ensure() {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(createSeedData(), null, 2));
    }
  }

  read() {
    this.ensure();
    return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
  }

  write(data) {
    this.ensure();
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }
}

module.exports = {
  JSONStore
};

