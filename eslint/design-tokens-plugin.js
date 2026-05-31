/* eslint-disable @typescript-eslint/no-require-imports */
const { rules } = require("./design-tokens");

module.exports = {
  rules,
  configs: {
    recommended: {
      rules: {
        "no-hardcoded-colors": "warn",
        "no-arbitrary-spacing": "warn",
      },
    },
  },
};
