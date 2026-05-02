const { handleApiRequest } = require("../backend/api-handler");

module.exports = async function handler(req, res) {
  return handleApiRequest(req, res);
};
