const { validateReleaseEnvironment } = require("./release-config");
module.exports = ({ config }) => {
  validateReleaseEnvironment(process.env);
  return config;
};
